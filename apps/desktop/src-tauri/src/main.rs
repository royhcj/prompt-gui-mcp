#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env::current_exe,
    io,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{Manager, RunEvent, Runtime, State, WindowEvent};

const BACKEND_ENTRY_RELATIVE_PATH: &str = "backend/dist/src/index.cjs";
const BACKEND_PORT: u16 = 43118;
const SIDECAR_NAME: &str = "i-am-mcp-node";

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

fn main() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_backend_origin])
        .setup(|app| {
            let backend_state = spawn_backend(app)
                .map_err(|error| io::Error::new(io::ErrorKind::Other, error))?;
            app.manage(backend_state);

            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        app_handle.exit(0);
                    }
                });

                let _ = window.set_always_on_top(true);
                let _ = window.show();
                let _ = window.set_focus();
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
