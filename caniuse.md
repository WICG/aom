## Can I Use Accessibility Object Model (AOM)

Track the implementation status of the AOM in various browsers.

## How to enable AOM

**Chrome**:
*For `AccessibleNode`/`ComputedAccessibleNode`-related features:*
```--enable-blink-features=AccessibilityObjectModel```

*For web platform related features:*
Browse to `chrome://flags`, enable `enable-experimental-web-platform-features`.

**Safari Technology Preview**:
```Develop > Experimental Features > Accessibility Object Model```

**Firefox**:
```about:config accessibility.AOM.enabled = true```

## Summary

Last updated: July 9, 2019

| | Chrome | Safari | Firefox |
| --- | --- | --- | --- |
| Phase 1: Reflect ARIA attributes on DOM nodes. | **Yes**, behind experimental-web-platform-features flag | **Yes** | **No** |
| Phase 1: Reflect element references for IDREF attributes | **No** | **No** | **No** |
| Phase 1: Custom element semantics on `ElementInternals` | **No** | **No** | **No** |
| Phase 2: Generated fallback events for AT actions | **No** | **No** | **No** |
| Phase 2: New InputEvent types | **No** | **No** | **No** |
| Phase 3: Build virtual accessible nodes. | **Yes**, out-of-date syntax | **No** | **No** |
| Phase 4: Query computed accessibility tree. | **Yes**, out-of-date syntax | **No** | **Yes**, out-of-date syntax |

### Phase 1: Reflect ARIA attributes on DOM nodes.

*Available in Safari; behind `--experimental-web-platform-features` flag in Chrome*

```js
element.role = "button";
element.ariaLabel = "Click Me";
```

### Phase 1: Reflect element references for IDREF attributes

*Not yet implemented*

Spec:
https://whatpr.org/html/3917/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes:element

```js
element.ariaActiveDescendantElement = otherElement;
element.ariaLabelledByElements = [ anotherElement, someOtherElement ];
```

### Phase 1: Custom element semantics on `ElementInternals` 

*Currently being implemented in Chrome: https://chromestatus.com/feature/5962105603751936*

Spec: 
https://whatpr.org/html/4658/custom-elements.html#native-accessibility-semantics-map

```js
class CustomTab extends HTMLElement {
  constructor() {
    super();
    this._internals = customElements.createInternals(this);
    this._internals.role = "tab";
  }

  // Observe the custom "active" attribute.
  static get observedAttributes() { return ["active"]; }

  connectedCallback() {
    this._tablist = this.parentElement;
  }

  setTabPanel(tabpanel) {
    if (tabpanel.localName !== "custom-tabpanel" || tabPanel.id === "")
      return;  // fail silently

    this._tabpanel = tabpanel;
    tabpanel.setTab(this);
    this._internals.ariaControls = tabPanel;    // does not reflect
  }

  // ... setters/getters for custom properties which reflect to attributes

  attributeChangedCallback(name, oldValue, newValue) {
    switch(name) {
      case "active":
        let active = (newValue != null);
        this._tabpanel.shown = active;

        // When the custom "active" attribute changes,
        // keep the accessible "selected" state in sync.
        this._internals.ariaSelected = (newValue !== null);

        if (selected)
          this._tablist.setSelectedTab(this);  // ensure no other tab has "active" set
        break;
    }
  }
}
```

### Phase 2: Generated fallback events for AT actions 

(Not yet specced/implemented)

```js
customSlider.addEventListener('keydown', (event) => {
  switch (event.code) {
  case "ArrowUp":
    customSlider.value += 1;
    return;
  case "ArrowDown":
    customSlider.value -= 1;
    return;
});
```

### Phase 2: New InputEvent types

(Not yet specced/implemented)

```js
customSlider.addEventListener("increment", function(event) {
  customSlider.value += 1;
});

customSlider.addEventListener("decrement", function(event) {
  customSlider.value -= 1;
});
```

### Phase 3: Build virtual accessible nodes.

*Chrome (out of date syntax, pass `--enable-blink-features=AccessibilityObjectModel`)*:

```
var listitem = new AccessibleNode();
listitem.role = "listitem";
listitem.offsetParent = list.accessibleNode;
listitem.offsetTop = 32;
listitem.offsetLeft = 0;
listitem.offsetWidth = 200;
listitem.offsetHeight = 16;

// future syntax may be: list.attachAccessibleRoot().appendChild
list.accessibleNode.appendChild(listitem);  
```

### Phase 4: Query computed accessibility tree.

*Chrome (speculative syntax, pass `--enable-blink-features=AccessibilityObjectModel`)*:

```
var c = await window.getComputedAccessibleNode(element);
console.log(c.role);
console.log(c.label);
```

*Firefox (out of date syntax)*:
```
console.log(element.accessibleNode.computedRole);
```
