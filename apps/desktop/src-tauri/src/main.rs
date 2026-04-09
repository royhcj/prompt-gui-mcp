#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env::current_exe,
    io,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{
    LogicalSize, Manager, RunEvent, Runtime, Size, State, WindowEvent, utils::config::Color,
};

const BACKEND_ENTRY_RELATIVE_PATH: &str = "backend/dist/src/index.cjs";
const BACKEND_PORT: u16 = 43118;
const SIDECAR_NAME: &str = "i-am-mcp-node";
const MAIN_WINDOW_LABEL: &str = "main";
const LIGHT_WINDOW_BACKGROUND: Color = Color(235, 223, 205, 255);
const DART_WINDOW_BACKGROUND: Color = Color(16, 39, 58, 255);
const DORAEMON_WINDOW_BACKGROUND: Color = Color(125, 215, 255, 255);
const DEFAULT_WINDOW_BACKGROUND: Color = DORAEMON_WINDOW_BACKGROUND;
const MIN_WINDOW_WIDTH: f64 = 260.0;
const MIN_WINDOW_HEIGHT: f64 = 320.0;
const WINDOW_SCREEN_MARGIN: f64 = 72.0;
const FALLBACK_MAX_WINDOW_HEIGHT: f64 = 900.0;

struct BackendState {
    origin: String,
    child: Mutex<Option<Child>>,
}

impl BackendState {
    fn new(origin: String, child: Child) -> Self {
        Self {
            origin,
            child: Mutex::new(Some(child)),
        }
    }

    fn shutdown(&self) {
        if let Some(mut child) = self.child.lock().expect("backend mutex poisoned").take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[tauri::command]
fn get_backend_origin(state: State<'_, BackendState>) -> String {
    state.origin.clone()
}

#[tauri::command]
fn set_window_theme<R: Runtime>(app: tauri::AppHandle<R>, theme: String) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Err("Main window is not available".to_string());
    };

    #[cfg(target_os = "macos")]
    window
        .set_background_color(Some(window_background_for_theme(&theme)))
        .map_err(|error| error.to_string())?;

    #[cfg(not(target_os = "macos"))]
    let _ = (window, theme);

    Ok(())
}

#[tauri::command]
fn resize_window_to_content<R: Runtime>(
    app: tauri::AppHandle<R>,
    content_height: f64,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Err("Main window is not available".to_string());
    };

    let scale_factor = window.scale_factor().map_err(|error| error.to_string())?;
    let current_size = window.inner_size().map_err(|error| error.to_string())?;
    let current_width = (current_size.width as f64 / scale_factor).max(MIN_WINDOW_WIDTH);

    let monitor_height = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .map(|monitor| monitor.size().height as f64 / scale_factor)
        .unwrap_or(FALLBACK_MAX_WINDOW_HEIGHT);

    let max_height = (monitor_height - WINDOW_SCREEN_MARGIN).max(MIN_WINDOW_HEIGHT);
    let target_height = content_height.clamp(MIN_WINDOW_HEIGHT, max_height);

    window
        .set_size(Size::Logical(LogicalSize::new(current_width, target_height)))
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn present_window<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Err("Main window is not available".to_string());
    };

    if window.is_minimized().map_err(|error| error.to_string())? {
        window.unminimize().map_err(|error| error.to_string())?;
    }

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn hide_window<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Err("Main window is not available".to_string());
    };

    window.hide().map_err(|error| error.to_string())?;

    Ok(())
}

fn sidecar_binary_name() -> String {
    if cfg!(target_os = "windows") {
        format!("{SIDECAR_NAME}.exe")
    } else {
        SIDECAR_NAME.to_string()
    }
}

fn resolve_sidecar_binary_path() -> Result<PathBuf, String> {
    let exe_path = current_exe().map_err(|error| error.to_string())?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "Failed to resolve executable directory".to_string())?;

    Ok(exe_dir.join(sidecar_binary_name()))
}

fn resolve_backend_entry_path<R: Runtime>(app: &tauri::App<R>) -> Result<PathBuf, String> {
    let exe_path = current_exe().map_err(|error| error.to_string())?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "Failed to resolve executable directory".to_string())?;

    let candidate_paths = [
        exe_dir.join(BACKEND_ENTRY_RELATIVE_PATH),
        app.path()
            .resource_dir()
            .map_err(|error| error.to_string())?
            .join(BACKEND_ENTRY_RELATIVE_PATH),
    ];

    candidate_paths
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| "Failed to locate bundled backend entrypoint".to_string())
}

fn spawn_backend<R: Runtime>(app: &tauri::App<R>) -> Result<BackendState, String> {
    let sidecar_path = resolve_sidecar_binary_path()?;
    let backend_entry_path = resolve_backend_entry_path(app)?;
    let origin = format!("http://127.0.0.1:{BACKEND_PORT}");

    let mut command = Command::new(sidecar_path);
    command
        .arg(backend_entry_path)
        .env("I_AM_MCP_SERVER_PORT", BACKEND_PORT.to_string())
        .stdin(Stdio::null());

    if cfg!(debug_assertions) {
        command.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    } else {
        command.stdout(Stdio::null()).stderr(Stdio::null());
    }

    let child = command.spawn().map_err(|error| error.to_string())?;
    Ok(BackendState::new(origin, child))
}

#[cfg(target_os = "macos")]
fn window_background_for_theme(theme: &str) -> Color {
    match theme {
        "dart" => DART_WINDOW_BACKGROUND,
        "doraemon" => DORAEMON_WINDOW_BACKGROUND,
        _ => LIGHT_WINDOW_BACKGROUND,
    }
}

fn main() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_backend_origin,
            set_window_theme,
            resize_window_to_content,
            present_window,
            hide_window
        ])
        .setup(|app| {
            let backend_state = spawn_backend(app)
                .map_err(|error| io::Error::new(io::ErrorKind::Other, error))?;
            app.manage(backend_state);

            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                #[cfg(target_os = "macos")]
                let _ = window.set_background_color(Some(DEFAULT_WINDOW_BACKGROUND));

                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(main_window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
                            let _ = main_window.hide();
                        }
                    }
                });

                let _ = window.set_always_on_top(true);
                let _ = present_window(app.handle().clone());
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            let state = app_handle.state::<BackendState>();
            state.shutdown();
        }
    });
}
