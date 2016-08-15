## Background: assistive technology and the accessibility tree

Assistive technology, in this context, refers to a third party application
which augments or replaces the existing UI for an application.
One well-known example is a screen reader,
which replaces the visual UI and pointer-based UI
with an auditory output (speech and tones)
and a keyboard and/or gesture-based input mechanism,
completely separate from any audio output or keyboard or gesture input handled by the app.

Many assistive technologies interact with a web page via accessibility APIs, such as 
[UIAutomation](https://msdn.microsoft.com/en-us/library/windows/desktop/ee684009.aspx)
on Windows, or
[NSAccessibility](https://developer.apple.com/library/mac/documentation/AppKit/Reference/NSAccessibility_Protocol_Reference/)
on OS X.
These APIs allow an application to expose a tree of objects representing the application's interface,
typically with the root node representing the application window,
with various levels of grouping node descendants down to individual interactive elements.

An assistive technology user interacts with the application almost exclusively via this API,
as the assistive technology uses it both to create the alternative interface,
and to route user interaction events triggered by the user's commands to the assistive technology.

For example, a [VoiceOver](https://www.apple.com/voiceover/info/guide/) user might press the key combination
"Control Option Spacebar" to indicate that they wish to click the element which the screen reader is currently visiting.
These keypresses would never be passed to the application,
but would be interpreted by the screen reader,
which would then call the `accessibilityPerformPress()` function on the element via the API.
This is then routed back to the DOM as a `click` event by the browser.

## Use cases

### Use DOM node references instead of IDREFs
Some HTML and ARIA features require reference to another element by IDREF,
but it's problematic in some contexts to require the accessibility code to generate IDs.
For example, some JS frameworks generated IDs automatically
and make maintaining the value of those IDs purposefully obtuse.
Likewise, in some extremes cases,
the expectation of IDREFs requires generating thousands of DOM modifications
which can lead to serious performance problems in the application.

Moreover, IDREFs cannot cross over Shadow DOM boundaries,
so any case which requires an ARIA relationship across these boundaries cannot be implemented today

This API would allow authors to associate related elements using a JavaScript object reference.

#### Example code

```html
<x-combobox>
  <x-optionlist>
    <x-option>Option 1</x-option>
    <x-option>Option 2</x-option>
    <x-option>Option 3</x-option>
 </x-optionlist>
</x-combobox>
```

```js
var combobox = document.querySelector('x-combobox');
var shadowRoot = combobox.createShadowRoot();
var input = document.createElement('input');
shadowRoot.appendChild(input);

var option1 = combobox.querySelectorAll('x-option')[0];
var axInput = input.accessibleNode;
var axOption1 = option1.accessibleNode;
axInput.activeDescendant = axOption1;
```

### Create virtual accessibility trees

Some authors create web interfaces using an HTML Canvas or some other direct-drawing API to render an interface
instead of using native HTML elements.

Currently the only way to make this type of solution accessible
is by creating hidden DOM elements for accessibility,
either as part of the Canvas fallback content,
or just with DOM elements placed behind the visual UI in the Z-order.
This is an ugly hack and it's wasteful,
as there's a lot of overhead to adding DOM elements to the page -
it impacts layout, style resolution, etc.

Instead, this API makes it possible to create virtual accessibility objects
for a portion of a page's accessibility tree.

#### Example code

```js
var canvas = document.querySelector('canvas');

// ... draw UI into canvas ...

var axRoot = canvas.accessibleNode;

var axOkButton = new AccesibleNode("button");
axOkButton.label = "Ok";
axOkButton.offsetWidth = /* width of canvas-drawn button, and similarly below */ 40;
axOkButton.offsetHeight = 10;
axOkButton.offsetLeft = 50;
axOkButton.offsetTop = 40;
// canvas already listens for click event within these coordinates, so fallback click event will do the job for us

axRoot.children.append(axOkButton);

var axCancelButton = new AccesibleNode("button");
axCancelButton.label = "Cancel";
axCancelButton.offsetWidth = /* width of canvas-drawn button, and similarly below */ 40;
axCancelButton.offsetHeight = 10;
axCancelButton.offsetLeft = 100;
axCancelButton.offsetTop = 40;

axRoot.children.append(axCancelButton);



```
