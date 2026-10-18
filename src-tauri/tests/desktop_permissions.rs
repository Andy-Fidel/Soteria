use std::{collections::BTreeMap, fs, path::Path};

use tauri::utils::{
    acl::{capability::Capability, manifest::Manifest, resolved::Resolved, ExecutionContext},
    platform::Target,
};

fn desktop_acl(target: Target) -> Resolved {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    // tauri-build generates these manifests from the installed plugin permissions.
    let manifests: BTreeMap<String, Manifest> =
        serde_json::from_slice(&fs::read(root.join("gen/schemas/acl-manifests.json")).unwrap())
            .unwrap();
    let capabilities = fs::read_dir(root.join("capabilities"))
        .unwrap()
        .map(|entry| {
            let capability: Capability =
                serde_json::from_slice(&fs::read(entry.unwrap().path()).unwrap()).unwrap();
            (capability.identifier.clone(), capability)
        })
        .collect();
    Resolved::resolve(&manifests, capabilities, target).unwrap()
}

#[test]
fn exports_and_updates_are_allowed_only_in_the_main_window() {
    for target in [Target::MacOS, Target::Windows, Target::Linux] {
        let acl = desktop_acl(target);
        for command in [
            "plugin:dialog|save",
            "plugin:fs|write_text_file",
            "plugin:fs|write_file",
            "plugin:updater|check",
            "plugin:updater|download",
            "plugin:updater|install",
            "plugin:updater|download_and_install",
            "plugin:process|restart",
        ] {
            let grants = acl.allowed_commands.get(command).unwrap_or_else(|| {
                panic!("{command} must be available on {target:?}");
            });
            for window in ["main", "broadcast", "broadcast-alt", "other"] {
                let allowed = grants.iter().any(|grant| {
                    grant.context == ExecutionContext::Local
                        && grant.windows.iter().any(|pattern| pattern.matches(window))
                });
                assert_eq!(
                    allowed,
                    window == "main",
                    "{command} permission for {window} on {target:?}"
                );
            }
            assert!(grants.iter().all(|grant| {
                grant.context == ExecutionContext::Local && grant.webviews.is_empty()
            }));
        }
    }
}

#[test]
fn export_writes_rely_on_the_save_dialog_instead_of_static_path_grants() {
    for target in [Target::MacOS, Target::Windows, Target::Linux] {
        let acl = desktop_acl(target);
        for command in ["plugin:fs|write_text_file", "plugin:fs|write_file"] {
            let grants = acl
                .allowed_commands
                .get(command)
                .expect("export write command");
            for grant in grants {
                if let Some(scope_id) = grant.scope_id {
                    assert!(acl.command_scope[&scope_id].allow.is_empty());
                }
            }
        }
        if let Some(scope) = acl.global_scope.get("fs") {
            assert!(
                scope.allow.is_empty(),
                "save dialog must grant the selected path"
            );
        }
    }
}
