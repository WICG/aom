function $(id) {
    return document.getElementById(id);
}
function init() {
    var aomEnabled = (document.body.accessibleNode != undefined);
    var nodes = document.querySelectorAll(".aom_enabled");
    for (var i = 0; i < nodes.length; i++)
        nodes[i].style.display = aomEnabled ? "block" : "none";
    nodes = document.querySelectorAll(".aom_disabled");
    for (var i = 0; i < nodes.length; i++)
        nodes[i].style.display = aomEnabled ? "none" : "block";

    var lastStr = '';
    async function speak() {
        let c = await getComputedAccessibleNode(document.activeElement);
        if (!c || c.role == null)
            return;
        let str =
            c.valueText + ' ' +
            c.name + ', ' +
            c.role +
            (c.checked != 'none' ? ' checked=' + c.checked : '') +
            (c.posInSet > 0 ? ' ' + c.posInSet + ' of ' + c.setSize : '');
        if (str != lastStr) {
            console.log(str);
            speechSynthesis.cancel();
            speechSynthesis.speak(new SpeechSynthesisUtterance(str));
        }
        lastStr = str;
    }
    document.addEventListener('focusin', speak);
    document.addEventListener('keyup', speak);
}

init();
