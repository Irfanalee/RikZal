use anyhow::Result;
use tray_icon::{
    menu::{Menu, MenuEvent, MenuItem},
    TrayIconBuilder,
};

pub fn run() -> Result<()> {
    let tray_menu = Menu::new();
    let quit_item = MenuItem::new("Quit RikZal", true, None);
    let brief_item = MenuItem::new("Morning Brief", true, None);
    tray_menu.append_items(&[&brief_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .with_menu(Box::new(tray_menu))
        .with_tooltip("RikZal")
        .build()?;

    let menu_channel = MenuEvent::receiver();
    let quit_id = quit_item.id().clone();

    loop {
        if let Ok(event) = menu_channel.try_recv() {
            if event.id == quit_id {
                break;
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    Ok(())
}
