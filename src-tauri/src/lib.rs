use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

fn is_engine_running() -> bool {
    let addr = match "127.0.0.1:5000".parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

fn launch_backend_if_needed() {
    if is_engine_running() {
        return;
    }

    let current_exe = std::env::current_exe().unwrap_or_default();
    let current_dir = current_exe.parent().unwrap_or(std::path::Path::new("."));

    let candidate_exes = vec![
        current_dir.join("RKDKCW_Audio_Studio.exe"),
        current_dir.join("backend").join("RKDKCW_Audio_Studio.exe"),
        current_dir.join("..").join("dist").join("RKDKCW_Audio_Studio").join("RKDKCW_Audio_Studio.exe"),
        std::path::PathBuf::from("dist/RKDKCW_Audio_Studio/RKDKCW_Audio_Studio.exe"),
    ];

    for exe_path in candidate_exes {
        if exe_path.exists() {
            let mut cmd = Command::new(&exe_path);
            #[cfg(windows)]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            if cmd.spawn().is_ok() {
                // Give it a moment to boot
                std::thread::sleep(Duration::from_millis(800));
                return;
            }
        }
    }

    // Fallback: python main.py
    let mut cmd = Command::new("py");
    cmd.args(["-3.13", "main.py"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    if cmd.spawn().is_ok() {
        std::thread::sleep(Duration::from_millis(800));
        return;
    }

    let mut cmd2 = Command::new("python");
    cmd2.arg("main.py");
    #[cfg(windows)]
    cmd2.creation_flags(0x08000000);
    let _ = cmd2.spawn();
    std::thread::sleep(Duration::from_millis(800));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    launch_backend_if_needed();

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
