## Can I Use Accessibility Object Model (AOM)

Track the implementation status of the AOM in various browsers.

## How to enable AOM

*Chrome*: `--enable-blink-features=AccessibilityObjectModel`

*Safari Technology Preview*: `Develop > Experimental Features > Accessibility Object Model`

*Firefox*: `about:config accessibility.AOM.enabled = true`

## Summary

Last updated: May 8, 2018

| | Chrome | Safari | Firefox |
| --- | --- | --- | --- |
| Phase 1: Reflect ARIA attributes on DOM nodes. | **Yes**, out-of-date syntax | **No** | **No** |
| Phase 2: Listen for input events from AT. | **Yes**, out-of-date syntax, 6 events | **Yes**, 8 events | **No** |
| Phase 3: Build virtual accessible nodes. | **Yes**, out-of-date syntax | **No** | **No** |
| Phase 4: Query computed accessibility tree. | **Yes**, out-of-date syntax | **No** | **Yes**, out-of-date syntax |

### Phase 1: Reflect ARIA attributes on DOM nodes.

*Chrome*:

```
element.accessibleNode.role = "button";
element.accessibleNode.label = "Click Me";
element.accessibleNode.labeledBy = new AccessibleNodeList();
element.accessibleNode.labeledBy.add(other.accessibleNode);
...
```

### Phase 2: Listen for input events from AT.

*Chrome*:

```
element.accessibleNode.addEventListener('accessibleclick', ...);
element.accessibleNode.addEventListener('accessiblecontextmenu', ...);
element.accessibleNode.addEventListener('accessiblefocus', ...);
element.accessibleNode.addEventListener('accessiblescrollintoview', ...);
element.accessibleNode.addEventListener('accessibleincrement', ...);
element.accessibleNode.addEventListener('accessibledecrement', ...);
```

*Safari Technology Preview*

```
element.addEventListener('accessibleclick', ...);
element.addEventListener('accessiblecontextmenu', ...);
element.addEventListener('accessiblefocus', ...);
element.addEventListener('accessiblescrollintoview', ...);
element.addEventListener('accessibleincrement', ...);
element.addEventListener('accessibledecrement', ...);
element.addEventListener('accessibledismiss', ...);
element.addEventListener('accessiblesetvalue', ...);
```

### Phase 3: Build virtual accessible nodes.

*Chrome*:

```
var listitem = new AccessibleNode();
listitem.role = "listitem";
listitem.offsetParent = list.accessibleNode;
listitem.offsetTop = 32;
listitem.offsetLeft = 0;
listitem.offsetWidth = 200;
listitem.offsetHeight = 16;
list.accessibleNode.appendChild(listitem);
```

### Phase 4: Query computed accessibility tree.

*Chrome*:

```
var c = await window.getComputedAccessibleNode(element);
console.log(c.role);
console.log(c.label);
```

*Firefox*:
```
console.log(element.accessibleNode.role);
console.log(element.accessibleNode.label);
```
