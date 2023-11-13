## Can I Use Accessibility Object Model (AOM)

Track the implementation status of the AOM in various browsers.

## Summary

Last updated: April 15, 2022

| | Chrome | Safari | Firefox |
| --- | --- | --- | --- |
| Phase 1: Reflect simple ARIA attributes on DOM nodes. | **Yes** | **Yes** | **Yes** |
| Phase 2: Reflect element references for IDREF attributes | **No** | **No** | **No** |
| Phase 2: Synthesized keyboard events aka User action events from Assistive Technology | **No** | **Yes** | **No** |
| Phase 2: Custom element semantics on `ElementInternals` | **Yes** | **No** | **No** |
| Phase 2: New accessibilty-specific InputEvent types | **Abandoned** | **Abandoned** | **Abandoned** |
| Phase 3: Build virtual accessible nodes. | **Blocked** | **Blocked** | **Blocked** |
| Phase 4: Query computed accessibility tree/properties. | **Partial** | **Partial** | **Partial** |

### Phase 1: Reflect simple ARIA attributes on DOM nodes.

* Safari/WebKit (supported)
* Chrome/Chromium (supported)
* Firefox/Gecko (supported) ([Shipping in 119](https://bugzilla.mozilla.org/show_bug.cgi?id=1785412) but [some remaining WPT test failures in 120](https://bugzilla.mozilla.org/show_bug.cgi?id=1858211))

```js
element.role = "button";
element.ariaLabel = "Click Me";
```

### Phase 2: Reflect element references for IDREF attributes

*Not yet implemented. Primarily intended to support Accessibilty refs across shadow root boundaries. *

Spec:
https://whatpr.org/html/3917/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes:element

```js
element.ariaActiveDescendantElement = otherElement;
element.ariaLabelledByElements = [ anotherElement, someOtherElement ];
```


### Phase 2: Synthesized keyboard events aka User action events from Assistive Technology

UAs synthesize logical keyboard equivalents for related AT actions.

Examples: AT increment/decrement on a slider will send synthesized up/down arrows. Dismiss on a dialog will send synthesized Escape key.

More detail: https://github.com/WICG/aom/blob/gh-pages/explainer.md#user-action-events-from-assistive-technology

* Safari/WebKit (supported)
* Chrome/Chromium (unsupported)
* Firefox/Gecko (unsupported)

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

### Phase 2: InputEvent types

(Abandoned path. No near-term planned support for Accessibilty-specific events.)

### Phase 2: Custom element semantics on `ElementInternals` 

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

### Phase 3: Build virtual accessible nodes.

Blocked by https://github.com/w3ctag/design-principles/issues/293

### Phase 4: Query computed accessibility tree/properties.

Partial testing context in [WebDriver (`computedRole`/`computedLabel`)](https://wpt.fyi/results/?label=master&label=experimental&aligned&q=label%3Aaccessibility) is already shipping in all implementations.

Investigation into [additional follow-on WebDriver interfaces for accessibilty](https://github.com/WICG/aom/issues/203).

#### Full Tree Access

Interop investigation into test-only interface for [Accessibilty Tree Dump API](https://github.com/web-platform-tests/interop-accessibility/issues/51)

##### Prior, Abandoned Approaches

*Chrome (speculative syntax, pass `--enable-blink-features=AccessibilityObjectModel`)*:

```js
var c = await window.getComputedAccessibleNode(element);
console.log(c.role);
console.log(c.label);
```

*Firefox (out of date syntax, `about:config accessibility.AOM.enabled = true`)*:

```js
console.log(element.accessibleNode.computedRole);
```
