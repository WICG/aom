# ARIA Reflection Explainer

**Authors:**

- Alice Boxhall, Google, aboxhall@google.com
- Dominic Mazzoni, Google, dmazzoni@google.com
- Meredith Lane, Google, meredithl@google.com
- Chris Hall, Google, chrishall@google.com

## Introduction

Forked from the [Accessibility Object Model explainer](explainer.md).

This document describes the proposed web standard for reflecting ARIA attributes,
meaning that web authors can get and set ARIA attributes on DOM elements directly
via JavaScript APIs, rather than by using setAttribute and getAttribute.

As a simple example, instead of writing this code:
```js
el.setAttribute("role", "button");
el.setAttribute("aria-pressed", "true");
```

you could write this more natural code instead:
```js
el.role = "button";
el.ariaPressed = "true";
```

Even more important, instead of needing to use an IDREF in order to
express a relationship between two elements:
```js
el.setAttribute("aria-labelledby", "label-id");
```

you could instead directly reference an element.
```js
el.ariaLabelledByElement = labelEl;
```

## Motivating use cases

The motivating use cases all revolve around the challenge in setting [relationship properties](https://www.w3.org/TR/wai-aria-1.1/#attrs_relationships) without needing to use IDREFs
   - Currently, to specify any ARIA relationship,
     an author must specify a unique ID on any element which may be the target
     of the relationship.
   - In the case of something like
     [`aria-activedescendant`](https://www.w3.org/TR/wai-aria-1.1/#aria-activedescendant),
     this may be one of hundreds or thousands of elements,
     depending on the UI.
     This requirement makes these APIs cumbersome to use
     and lead to many extra DOM attributes being necessary.
     It can be difficult to ensure that programmatically-generated IDs are globally unique.
   - If the target of the IDREF is in a different tree scope, establishing a
     relationship is impossible. That prevents relationships like
     [`aria-activedescendant`](https://www.w3.org/TR/wai-aria-1.1/#aria-activedescendant),
     and
     [`aria-labelledby`](https://www.w3.org/TR/wai-aria-1.1/#aria-labelledby)
     from being used across Shadow DOM boundaries.

### Reflecting simple ARIA attributes

For the role attribute and all other ARIA attributes where the type is a boolean,
enum, number, or string, we will
[reflect](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflect)
these ARIA attributes on HTML elements, e.g.:

```js
el.role = "button";
el.ariaPressed = "true";
el.ariaDisabled = "false";
```

The reflection is bidirectional:
```js
el.setAttribute("aria-atomic", "true");
assert el.ariaAtomic == "true";
```

#### Spec/implementation status

This is now a part of the [ARIA 1.2 spec](https://www.w3.org/TR/wai-aria-1.2/#idl-interface).

This is shipping in Safari, Chrome, and Edge and it's implemented behind a flag
(`accessibility.ARIAReflection.enabled`) in Firefox.

### Reflecting Element references

Straight reflection of ARIA properties
would reflect relationship attributes like `aria-labelledby` as strings:

```js
el.ariaDescribedBy = "id1";
```

results in

```html
<div aria-describedby="id1"></div>
```

We propose augmenting this API with non-reflected properties
which take element references:

```js
el.ariaDescribedByElements = [labelElement1, labelElement2];
el.ariaActiveDescendantElement = ownedElement1;
```

> Note: the `Element` or `Element` suffixes are a naming choice
> for the reflected property,
> and do not imply that there will be both string and Element properties
> for the same attribute.

This would allow specifying semantic relationships between elements
without the need to assign globally unique ID attributes to each element
which participates in a relationship.

Moreover, this would enable authors using open `ShadowRoot`s
to specify relationships which cross over Shadow DOM boundaries.

#### Querying relationship attributes

When an ARIA relationship attribute is set in the HTML DOM, it can be observed
via new reflected attributes. This example demonstrates it with
aria-activedescendant, which is reflected as ariaActiveDescendantElement.

```html
<div id='fruitbowl' role='listbox' aria-activedescendant='apple'>
  <div id='apple'>I am an apple</div>
</div>
```

```js
// We can observe the active descendant relationship through the content attribute.
assert_equals(fruitbowl.getAttribute("aria-activedescendant"), "apple");

// And we can also observe it through the new api.
assert_equals(fruitbowl.ariaActiveDescendantElement, apple);
```

When an ARIA attribute takes a list of IDREFs rather than a single one,
the reflected attribute behaves like an array of elements.

```html
<span id="l1">Street name</span>
<input aria-labelledby="l1 l2">
<span id="l2">(just the name, no "Street" or "Road" or "Place")</span>
```

```js
// We can observe the labelled-by relationship through the content attribute.
assert_equals(input.getAttribute("aria-labelledby"), "l1 l2");

// And we can also observe it through the new api.
assert_equals(input.ariaLabelledByElements.length, 2);
assert_equals(input.ariaLabelledByElements[0], l1);
assert_equals(input.ariaLabelledByElements[1], l2);
```

#### Sprouting relationship attributes

When using reflection to set ARIA relationship properties, the element (MUST NOT|SHOULD NOT) "sprout" new attributes. This is different than the reflection of simple ARIA attributes (because reasons). 

```html
<div id='fruitbowl' role='listbox'>
  <div id='apple'>I am an apple</div>
</div>
```

```js
// We make the active descendant of the fruitbowl the apple through our new api.
fruitbowl.ariaActiveDescendantElement = apple;

// We can observe the relationship.
assert_equals(fruitbowl.ariaActiveDescendantElement, apple);
// The fruitbowl has not sprouted a matching content attribute. This assertion will fail.
assert_equals(fruitbowl.getAttribute("aria-activedescendant"), "apple");
```

Although the content attribute will not sprout, the relationship will still be
communicated correctly to assistive technology.

```html
<div id='fruitbowl' role='listbox'>
</div>
```

```js
const apple = document.createElement("div");
apple.innerHTML = "I am an apple";
fruitbowl.appendChild(apple);

// We make the active descendant of the fruitbowl the apple.
fruitbowl.ariaActiveDescendantElement = apple;
// We can observe this relationship as the apple is not in a valid scope.
assert_equals(fruitbowl.ariaActiveDescendantElement, apple);

// No content attribute is sprouted as apple lacks an id.
// However, the relationship is still there, it's still communicated
// to assistive technology. It's just invisible from the DOM.
assert_equals(fruitbowl.getAttribute("aria-activedescendant"), "");
```

In this example, attempting to set a relationship to an element that's not
attached to the document yet will not sprout an attribute - and subsequently
if the target element is added to the DOM, it still won't have a content
attribute.

```html
<div id='fruitbowl' role='listbox'>
</div>
```

```js
const apple = document.createElement("div");
apple.setAttribute("id", "apple");
apple.innerHTML = "I am an apple";

// We make the active descendant of the fruitbowl the apple.
fruitbowl.ariaActiveDescendantElement = apple;

// NB: we are appending *after* setting.
fruitbowl.appendChild(apple);

// We can observe this relationship as the apple is not in a valid scope.
assert_equals(fruitbowl.ariaActiveDescendantElement, apple);

// No content attribute is sprouted as apple was in an invalid scope when set.
assert_equals(fruitbowl.getAttribute("aria-activedescendant"), "");
```

#### Relationships are validated on get

Relationships are validated on get, and are kept intact through invalid states.

```html
<div id='fruitbowl' role='listbox'>
  <div id='apple'>I am an apple</div>
</div>
<div id='shadowFridge'></div>
```

```js
const apple = document.getElementById("apple");
const shadowRoot = shadowFridge.attachShadow({mode: "open"});

// We make the active descendant of the fruitbowl the apple.
fruitbowl.ariaActiveDescendantElement = apple;
assert_equals(fruitbowl.ariaActiveDescendantElement, apple);
assert_equals(fruitbowl.getAttribute("aria-activedescendant"), "apple");

// We then move the referenced element (apple) into shadow DOM (fridge).
shadowRoot.appendChild(apple);
// The active descendant relationship is now non-observable.
assert_equals(fruitbowl.ariaActiveDescendantElement, null, "computed attr-assoc element should be null as referenced element is in an invalid scope");
// NB: The attribute still exposes the referenced element's id.
assert_equals(fruitbowl.getAttribute("aria-activedescendant"), "apple");

// Move the referenced element (apple) back out of the shadow DOM (fridge).
fruitbowl.appendChild(apple);
// Our active descendant relationship remained intact!
assert_equals(fruitbowl.ariaActiveDescendantElement, apple);
```

#### Multi-valued (array) relationship attributes are supported

ARIA relationship attributes that take a list of IDREFs reflect to an
array of IDREFs.

```html
<div id='fruitbowl' role='listbox'>
  <div id='apple'>I am an apple</div>
  <div id='pear'>I am a pear</div>
</div>
```

```js
const apple = document.getElementById("apple");

fruitbowl.ariaDescribedByElements = [apple, pear];
assert_array_equals(fruitbowl.ariaDescribedByElements, [apple, pear]);
assert_equals(fruitbowl.getAttribute("aria-describedby"), "apple pear");

// Temporarily remove apple from the document.
apple.remove();
// The relationship with apple is hidden but kept intact.
assert_array_equals(fruitbowl.ariaDescribedByElements, [pear]);

// Reinsert apple back into the document.
fruitbowl.appendChild(apple);
// The relationship with apple remained intact!
assert_array_equals(fruitbowl.ariaDescribedByElements, [apple, pear]);
```

#### Multi-valued (array) relationship attributes may violate equality expectations

When interacting with a reflected multi-valued (array) ARIA relationship attribute,
it may violate typical JavaScript object property expectations. For example,
if you retrieve the same array twice in a row, the two returned objects may not
be the same object using a === equality check.

```html
<div id='fruitbowl' role='listbox'>
  <div id='apple'>I am an apple</div>
  <div id='pear'>I am a pear</div>
</div>
```

```js
const apple = document.getElementById("apple");

let array1 = [apple, pear];
fruitbowl.ariaDescribedByElements = array1;

// Retrieving the same property won't equal the array that we set it to:
assert_false(array1 === fruitbowl.ariaDescribedByElements);

// However, the contents will be the same:
assert_true(array1.length == fruitbowl.ariaDescribedByElements.length);
assert_true(array1[0] === fruitbowl.ariaDescribedByElements[0]);
...

// Even accessing the same property twice won't result in the same object:
let array2 = fruitbowl.ariaDescribedByElements;
let array3 = fruitbowl.ariaDescribedByElements;
assert(false(array2 === array3);
```

#### Spec/implementation status

- This API is being [proposed](https://github.com/whatwg/html/issues/3515)
  as a change to the WHATWG HTML spec.
- There is an [open PR](https://github.com/whatwg/html/pull/3917) on the HTML spec
  fleshing out the details for this API.
- This is used in the [ARIA editor's draft](https://w3c.github.io/aria/#AriaAttributes).
- This is [currently being implemented in Blink](https://www.chromestatus.com/feature/6244885579431936).
