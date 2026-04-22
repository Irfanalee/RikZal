mod db;
mod ipc;
mod os;
mod tray;

use anyhow::Result;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("rikzal_daemon=debug".parse()?),
        )
        .init();

    info!("RikZal daemon starting");

    let data_dir = dirs::data_dir()
        .expect("could not find data dir")
        .join("rikzal");
    std::fs::create_dir_all(&data_dir)?;

    db::init(&data_dir).await?;

    // Start the IPC server in background
    let ipc_path = data_dir.join("rikzal.sock");
    tokio::spawn(ipc::serve(ipc_path));

    // Start OS tray (blocks the main thread on macOS — must run on main thread)
    tray::run()?;

    Ok(())
}
