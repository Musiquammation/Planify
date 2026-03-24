export function openTutorial() {
    const dialog = document.getElementById("tutorial")! as HTMLDialogElement;
    
    dialog.showModal();
    
    document.getElementById("closeTutorial")!.addEventListener("click", () => {
        dialog.close();
    });
}
