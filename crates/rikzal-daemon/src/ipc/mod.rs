mod protocol;

pub use protocol::Message;

use anyhow::Result;
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixListener;
use tracing::{error, info};

pub async fn serve(socket_path: PathBuf) -> Result<()> {
    if socket_path.exists() {
        std::fs::remove_file(&socket_path)?;
    }

    let listener = UnixListener::bind(&socket_path)?;
    info!("IPC server listening at {}", socket_path.display());

    loop {
        match listener.accept().await {
            Ok((mut stream, _)) => {
                tokio::spawn(async move {
                    let mut len_buf = [0u8; 4];
                    if stream.read_exact(&mut len_buf).await.is_err() {
                        return;
                    }
                    let len = u32::from_be_bytes(len_buf) as usize;
                    let mut buf = vec![0u8; len];
                    if stream.read_exact(&mut buf).await.is_err() {
                        return;
                    }

                    match rmp_serde::from_slice::<Message>(&buf) {
                        Ok(msg) => {
                            if let Some(response) = handle(msg).await {
                                if let Ok(encoded) = rmp_serde::to_vec(&response) {
                                    let len = (encoded.len() as u32).to_be_bytes();
                                    let _ = stream.write_all(&len).await;
                                    let _ = stream.write_all(&encoded).await;
                                }
                            }
                        }
                        Err(e) => error!("IPC decode error: {e}"),
                    }
                });
            }
            Err(e) => error!("IPC accept error: {e}"),
        }
    }
}

async fn handle(msg: Message) -> Option<Message> {
    match msg {
        Message::Ping => Some(Message::Pong),
        Message::BriefReady { date, narrative, audio_path } => {
            info!("Morning brief ready for {date}");
            // TODO: forward to Tauri window via event system
            let _ = (narrative, audio_path);
            None
        }
        _ => None,
    }
}
