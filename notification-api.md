# Accessibility (ARIA) Notification API
**Note: This explainer is no longer being maintained. For the most up-to-date version of this feature, please [click here](https://github.com/WICG/accessible-notifications).**

Authors: 
* [Daniel Libby](https://github.com/dlibby-), Microsoft
* [Sara Tang](https://github.com/sartang), Microsoft
* [Travis Leithead](https://github.com/travisleithead), Microsoft


## Abstract

For limited-vision or non-sighted users, identifying dynamic changes (non-user-initiated) in the content
of a web app is very challenging. ARIA live regions are the only mechanism available
today that communicate content changes down to the accessibility layer so that users
can hear about them. ARIA live regions are inconsistently implemented, have poor 
developer ergonomics, and are being used in ways that they weren't designed for (e.g., as 
a notification-like API for changes unrelated to "live regions").
We propose an imperative **notification API** designed to replace the usage of 
ARIA live regions in scenarios where a visual "live region" isn't necessary.

## Introduction

Screen readers provide an audible presentation of web content for various kinds
of users with disabilities (e.g., those with limited or no vision). The screen
reader knows what to say based on the semantic structure of a document. Screen
readers move through the content much the same way a sighted user might scan
through the document with their eyes. When something about the document changes
(above the fold), sighted users are quick to notice the change. When
something below the fold (offscreen) changes, sighted users have no way of knowing
that there was a change nor how important a change it might be. This latter case is the 
conundrum for non-sighted users in general: how and when should changes in the
content be brought to their attention?

Screen readers and content authors work together to try and solve this problem. 
One way screen readers are informed about content changes is through ARIA live 
regions. A live region is an element (and its children) that is expected to change
dynamically (such as a message chat), and for which the changes should be announced
to the user.

The design of live regions is intended to give maximum flexibility to screen readers
to implement an experience that is best for their users. Web authors provide hints
via attributes on the live region element in order to influence the spoken output, such
as:
* `aria-atomic` should the whole text content of the element be notified or just the 
    changes since the last update?
* `aria-relevant` which content changes are relevant for the notification? Additions or
    removals (or both)?
* `aria-busy` signals that a batch of changes are coming and to wait until the batch is
    complete before notifying.
* `aria-live` a general signal of the priority of the region's changes: "assertive" or 
    "polite".

## Problems with Consistency and Predictability

Content authors have a difficult time creating consistent and predictable notification
experiences for their users with accessibility needs even with the above-mentioned 
controls. Some of the reason is due to variation in screen reader implementation
approaches. In other cases, the inner workings of a browser's accessibility tree are 
the source of the problem. Some examples:

1. Screen reader output varies greatly depending on the complexity of the live region's
    content (e.g., elements and nested elements). To get consistency, content authors will 
    strip-out all the richness (and semantics) of the HTML content in the live region, 
    leaving only text in hopes of getting a more uniform experience.
2. When content authors update the DOM in a live region, those changes may or may not get
    sent by the browser to a screen reader. [In one case](https://docs.google.com/document/d/1NaQS90h_LPD1YduCk2Gj4i5GMycjnksbQIpVJ67ooCA/edit?resourcekey=0-_z0yTNYZkPteppA1UGGNPw#heading=h.opld0djiwaju), it was discovered that the browser's
    implementation was not properly detecting changes to the live region.
3. The available priority controls ("assertive" vs. "polite") are not well specified and
    up to the interpretation of screen readers. In one instance an author wanted to make
    a live region announcement immediately following a user action to supplement it with 
    related context. However, the "polite" setting was too polite; a subsequent focus change
    would always mute the announcement. The "assertive" setting was too assertive and 
    caused subsequent (important) focus change context to be lost while the assertive 
    announcement was made.

Content authors still rely on live regions because that is the only tool available for the
job. They do the best that they can, resorting to ugly "hacks", fragile
coding patterns, and blatent misuse of ARIA live regions. There is a better way.

## Additional Concerns

* Live regions are built around the assumption that a _visual_ change needs to be
   announced, hence they are tightly coupled with DOM nodes. Many changes important
   to announce are not necessarily tied to a visual action. In these cases, "live 
   region hacks" are employed using offscreen DOM nodes to host the live region--there
   is no surrounding context (an important consideration for many screen readers), 
   nor any area to focus (for low-vision users).
  
* Offscreen live regions (see above) do not play a visual role in the content's 
   presentation and as a result are subject to second-class treatment: forgotten during
   content updates, accidentally broken due to missing testing, or simply relegated to 
   an "accessible version" of the site usually because of performance overhead concerns.
   Accessibility should be designed into the content experience from the start, not 
   bolted-on as an extra or add-on feature.

## Goals

* Offer an alternative to "offscreen live region" scenarios that:
   * serves content authors' needs first; has easy-to-use developer ergonomics
   * solves the consistency and predictability problems of live regions
* Provide a design framework for improvements to live regions as a "declarative
   version" of the notification API.

## Use Cases

### Keyboard action confirmation

Keyboard commands (especially those without a corresponding UI affordance) when activated 
may need to confirm the associated state change with the user. The following cases are
variations on this theme:

1. **Glow text command:** User is editing text, highlights a word and presses 
    `Shift`+`Alt`+`Y` which makes it glow blue. No UI elements were triggered or changed
    state, but the user should hear some confirmation that the action was successful, 
    such as "selected text is now glowing blue."

2. **Set Presence**. In a chat application, the user presses `Shift`+`Alt`+`4` to toggle
    their *presence* state to `do not disturb`. The application responds with "presence set
    to do not disturb."

   2.1. **Most recent notification priority:** the user presses `Shift`+`Alt`+`3` by mistake,
         and then quickly presses `Shift`+`Alt`+`4`. The application began to respond with
         "presence..." [set to busy] but interrupts itself with the latest response "presence
         set to do not disturb."

   2.2. **Overall priority.** The user presses `Shift`+`Alt`+`4`, then immediately issues a
         command to the screen reader to jump to the next header. The response "presence set to
         do not disturb" will be skipped, deferred, interrupted, or pre-empt the contextual read-out
         of the focus change event depending on the content author's design.

### Failed or delayed actions

According to common screen reader etiquette, user actions where the context is clear are assumed
to be successful by virtue of issuing the command to do the action itself (no specific confirmation
of the action is needed); however, if the action fails or is delayed, the user should then be notified.
Otherwise the user's understanding about the state of the app will be wrong.

3. **Longer than usual.** User completes typing a mail message, presses _send_. In normal
    circumstances, the message is sent (no confirmation of "sent" is needed). However, due to
    networking conditions, the _send_ action is taking longer than usual. The user hears 
    "message is taking longer than usual to send".

4. **Fail to paste.** User thought they had copied some text onto the clipboard, but in the
    context of editing when they issue the "paste" keyboard shortcut, nothing is in the clipboard
    and nothing pastes into the app. The app causes the screen reader to note the failed action:
    "failed to paste, clipboard empty".

### Secondary actions

In addition to a primary (implicit) action, some actions have secondary or follow-up effects 
that should be announced beyond the immediate effect of the primary action.

5. **Auto fill.** In a spreadsheet, an action that sets a cell's value may be assumed to happen
    (no announcement) or could be announced as a side-effect of changing the cell's value (e.g., 
    using a live region). In either case this would be the normal expectation for the user. However,
    as a result of setting the value, the spreadsheet takes a secondary action of autofilling a
    range of corresponding values in the cell's column. The screen reader links the announcement 
    "autofilled values in cells A2 through A20" to the user's last action and ensures they are 
    correlated.

## Proposed Solution

A new API `ariaNotify` enables content authors to directly tell a screen reader what to read.
Similar to an ARIA live region, but without the guesswork and previously-described inconsistencies
in processing. In the simplist scenario, the content author calls the function with a string to read.
The language of the string is assumed to match the document's language. The function can be called from
the document or from an element. When called from an element, the element's nearest anscestor's `lang` 
attribute is used to infer the language.

`ariaNotify` is an asynchronous API. There is no guarantee that a screen reader will read the text at
that particular moment, nor is there a way to know that a screen reader is available at all! Well
designed web applications will use `ariaNotify` to provide appropriate notifications for accessibility
whether or not their users require a screen reader or not.

Example 1:

```js
// Queue a message to the notification queue associated with the document:
document.ariaNotify( "New collaborator X is now connected." );
// Queue a message to the notification queue associated with an element:
document.querySelector("#richEditRegion1").ariaNotify( "Selected text is now glowing blue." );
```

`ariaNotify` does not return a value. The call to the API has no web-observable side effects 
and its use should not infer that the user is using assistive technology.

The document, and each element in the DOM all have separate **pending notification array**s,
initially empty. 

The above code places the first notification into the *document object*'s
pending notification array and the second into the pending notification array of an element 
with id "richEditRegion1". Because these arrays are different, there is no guarantee that 
the first notification in the above sequence will be the first to be uttered by the screen 
reader. The screen reader may service the various pending notification arrays in any order
or sequence (potentially informed by which queue is closest to the current point of focus in
the DOM).

The only guarantees that can be made with respect to ordering are the order of items within
a single pending notification array itself. Therefore in the following example, "message 1"
is guaranteed to be uttered before "message 2". Because the screen reader may service different
pending notification arrays at different times and without exhausting any of the arrays, other
messages may be uttered by the screen reader between the uttering of "message 1" and "message 2".

Example 2:

```js
// In the following, "message 1" will be read before "message 2" because they are inserted
// into the same pending notification array:
let someEl = document.querySelector("#someElement");
someEl.ariaNotify( "message 1" );
someEl.ariaNotify( "message 2" );
```

A screen reader must not only manage all the pending notification arrays in a document, but also all
the messages from other sources including the OS, other applications, input keystrokes from the user,
focus changes, ARIA live region updates, etc. This explainer **does not** specify nor constrain the
screen reader regarding the ordering of `ariaNotify` notifications with respect to these other 
messages that exist in some total order of the screen reader's message queue.

For interoperability, this explainer **does require** that all notifications originating from
`ariaNotify` that are inserted into one pending notification array adhere to the relative order
specified by this explainer. Screen readers are not permitted to re-order the notifications within
a pending notification array--they may only pull from the service end of such arrays.

### Screen reader customizations for user preference

Screen readers offer the flexibility to customize the notification experience for their users.
Customization options for user preferences include disabling, prioritizing, filtering, and 
providing alternate output for notifications (such as the concept of 
[earcons](https://en.wikipedia.org/wiki/Earcon)). Without
additional context, only two customization options can be offered: options that apply to all 
`ariaNotify` notifications universally, or customization on a per-notification-string basis.

To aid in customization, `ariaNotify` provides a method for labelling notifications. This 
explainer provides a set of potential label suggestions, but allows for arbitrary strings
to be used for labelling by the content author. All strings will be processed according
to a fixed algorithm ([ASCII encode](https://infra.spec.whatwg.org/#ascii-encode) then 
[ASCII lowercase](https://infra.spec.whatwg.org/#ascii-lowercase) and finally
[strip leading and trailing ASCII whitespace](https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace))
before their application to the resulting notification (invalid strings will throw).

When no label is explicity provided by the content author, the label `notify` is assigned
by default.

Note: implementations using an existing notification infrastructure provided by an OS 
accessibility API that is shared by other apps (aside from the browser) may wish to mark
all notifications coming from web content in a unique way that differentiates them from
other labelled notifications for purposes of security and privacy.

To specify a label, pass the label string as the second parameter. Alternatively, the 
label may be expressed in an object form with property `label`. For example:

Example 3:

```js
// Notify of a long-running async task starting and ending
document.ariaNotify( "Uploading file untitled-1 to the cloud.", "task-progress-started" );
myfile.asyncFileUpload().then( () => {
  document.ariaNotify( "File untitled-1 uploaded.", { label: "task-progress-finished" } );
} );
```

Screen readers may allow their users to filter out these task-progress labels, or to make
these notifications only available to particular verbosity levels, or to replace the output
strings with audio cues.

Recommended labels:

⚠️Issue: these label recommendations are not yet reviewed by screen readers

* Recent action completion status: `action-completion-success`, `action-completion-warning`, `action-completion-failure`
* Async/indeterminate task progress: `task-progress-started`, `task-progress-ongoing`, `task-progress-blocked`, `task-progress-canceled`, `task-progress-finished`
* Navigational boundary endpoints: `boundary-beginning`, `boundary-middle`, `boundary-end`
* Value-relative state changes: `value-increase`, `value-decrease`
* User interface state: 
   * `ui-clickable` / `ui-clicked`
   * `ui-enabled` / `ui-disabled`
   * `ui-editable` / `ui-readonly`
   * `ui-selected` / `ui-unselected`

### Managing a pending notification array

Within one pending notification array, multiple `ariaNotify` calls will append notifications 
into its array as if the array is a queue. This is the default behavior.

The delay between the time a notification is placed into the pending notification array and 
when it is removed by a screen reader for uttering allows for the array to have many
notifications waiting to be processed. During that interval, a high-priority notification may
want to "jump the queue" to go next, rather than wait in line.

In order to place a notification into the "head" of the pending notification array (the end 
that the screen reader services), `ariaNotify` must be switched into "stack" insertion mode 
("queue" mode is the default).

Example 4:

```js
// In response to arrow keys for some custom listbox representation...
document.ariaNotify( "End of list.", "boundary-end" );
// ...
document.ariaNotify( "End of list.", "boundary-end" );
// ...
document.ariaNotify( "End of list.", "boundary-end" );
// and suddenly...
document.ariaNotify( "Are you sure you want to delete this item?", { 
  insertionMode: "stack",
  label: "action-completion-warning" 
} );
```

The warning about deleting the list item is more important to service as soon as 
possible. The "stack" insertion mode, places the item in the array in the next-to-be-serviced
spot ahead of the other "boundary-end" labelled items.

It also seems a little repetitive to have multiple "End of list." notifications read
out to the user, even if they did cause multiple notifications to be generated. In this
case, these items can be inserted in "clear" mode, so that they clear the array of any
other notifications before insertion. In that way there's only ever one item in the 
array at a time. The "clear" insertion mode respects labels, so if a label is provided 
the pending notification array is only cleared of notifications of the specified label.
(So we don't need to worry about the accidental erasure of the deletion warning regardless
of the order it comes in.)

Example 5:

```js
// In response to arrow keys for some custom listbox representation...
document.ariaNotify( "End of list.", { insertionMode: "clear", label: "boundary-end" } );
// ...
document.ariaNotify( "End of list.", { insertionMode: "clear", label: "boundary-end" } );
// ...
document.ariaNotify( "End of list.", { insertionMode: "clear", label: "boundary-end" } );
// and suddenly...
document.ariaNotify( "Are you sure you want to delete this item?", { 
  insertionMode: "stack",
  label: "action-completion-warning" 
} );
```

In summary:

* `insertionMode` indicates which end of the pending notification array the new notification
    should be inserted into: 
    * `queue` at the back (traditional queuing 
       [FIFO](https://en.wikipedia.org/wiki/FIFO_(computing_and_electronics)) behavior, similar 
       to ARIA live region's "polite" value)
    * `stack` at the front (traditional stack LIFO behavior. This notification will be serviced 
       next, similar to ARIA live region's "assertive" value)
    * `clear` clear the pending notification array of any previous notifications and then add 
       this notification.
    * The **default value** is `queue`.

Individual notifications may also be given processing recommendations or restrictions. These
may or may not be possible to honor by screen readers. The following values can be added to the 
options object provided in the second parameter to `ariaNotify`.

* `interruptCurrent` when this notification gets to the front of the pending notification array, is 
    it allowed to pre-empt an existing utterance? Has values `true` and `false`.
    * The **default value** is `false`.
* `preventInterrupt` when this notification is being uttered by the screen reader, should it be allowed
    to be interrupted? `false` if it can be interupted, `true` if the entire utterance should finish
    before the next utterance begins.
    * The **default value** is `false`.
    * Note: the screen reader's "stop talking" keystroke always interrupts no matter what is 
       specified here.

Finally, it may be necessary to clear a pending notification array **without** adding a 
notification at the same time. (Such as if a series of notifications become completely 
irrelvant as when a navigation in a single-page-app is occuring.) To clear the entire queue:

Example 6:

```js
document.ariaNotify( null, { insertionMode: "clear" } );
```

To clear just a subset of the notifications in the queue, add a label specifying which matching
notifications should be cleared.

## Bindings to User Activation

In many instances, an `ariaNotify` will be done in the context of some user action. It 
can be helpful for screen readers to know that a particular notification is associated
with user input so that it can be correlated to follow any input-related utterances.

Rather than provide an explicit method for content authors to make this association,
usages of `ariaNotify` within a [user activation](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation)
should automatically have a flag added to the resulting notification(s) by the UA that
associates the notification with the current/last user activation in a way that is visible
to the screen reader and allows notification from user gestures to be uttered "in flow".

Other usages of `ariaNotify`, such as from within setTimeout functions, will not have
this association.

## iframes and use in subresources

We propose that use of `ariaNotify` by limited to top-level browsing contexts, but that
this be a capability that can be allowed through [Permission Policy](https://github.com/w3c/webappsec-permissions-policy/blob/main/features.md)
with a new policy name (TBD).

## Relationship to ARIA Live Regions

`ariaNotify` can provide imperative clarity on how existing declarative ARIA live regions 
should work, and also provide a framework for future extensions to ARIA live regions to
bring it up to parity with `ariaNotify` capabilities. This section maps the existing
ARIA live regions configuration attributes to the options available with `ariaNotify`.

When muliple ARIA live regions are in use at one time in one document, it is 
under-specified what type of queuing mechanisms are present. Because changes to ARIA live
regions are sent to screen readers as events that require work on the screen reader to 
collect the relevant text to utter, we can assume that there is only one "logical" pending
notification array for all ARIA live regions present (no separation of queues). For
simplification we will consider only a single ARIA live region.

* `aria-live="assertive"` is the equivalent of `insertionMode: stack` thereby prioriting the
   assertive notification ahead of any other waiting notification. Additionally, the 
   notification is given the equivelent of `interruptCurrent: true` in order to speak over
   an existing utterance and `preventInterrupt: true`.
* `aria-live="polite"` is the equivalent of `insertionMode: queue` where each notification 
   waits its turn, and `interruptCurrent: false` so that the notification remains "polite" 
   and does not interrupt, but can be interrupted (`preventInterrupt: false`).
   
There is no mechanism with ARIA live regions to support `insertionMode: clear` in order to
"fold" similar notifications together.

There is no support for the other potential combinations of `insertionMode`, `interruptCurrent`
or `preventInterrupt`.

There is no support for grouping (via label) particular classes of changes to an ARIA live
region.

There is no way to "clear" a previously issued ARIA live region update.

### ARIA Live Region supplemental features (ideas)

1. Add a new value to `aria-live`: `"custom"` to set an ARIA live region to have additional 
    configurable settings (see below).
2. Add a new attribute `aria-live-mode` with values: `"stack"`, `"queue"`, and `"clear"` 
    whose values cause notification to be configured as specified previously for `insertionMode`.
    * The missing value default is `"queue"` (the default behavior of an ARIA live region).
    * Note:
       * `aria-live="assertive"` forces `aria-live-mode` to `"stack"` regardless of what other 
          attribute value it may have.
       * `aria-live="polite"` forces `aria-live-mode` to `"queue"` regardless of what other
          attribute value it may have.
3. Add a new attribute `aria-live-interrupt` with values: `"true"` and `"false"` mapping to
    the behavior specified previously for `interruptCurrent`.
    * The missing value default is `"false"`.
    * Note: 
       * `aria-live="assertive"` forces `aria-live-interrupt` to `"true"` regardless of what other
          attribute value it may have.
       * `aria-live="polite"` forces `aria-live-interrupt` to `"false"` regardless of what other
          attribute value it may have.
4. Add a new attribute `aria-live-interruptible` with values: `"true"` and `"false"` mapping
    to the **opposite** behavior specified previously of `preventInterrupt`.
    * The missing value default is `"true"`.
    * Note:
       * `aria-live="assertive"` forces `aria-live-interruptible` to `"false"` regardless of what other
          attribute value it may have.
       * `aria-live="polite"` forces `aria-live-interruptible` to `"true"` regardless of what other
          attribute value it may have.
6. Setting `aria-live` to `"assertive"` or `"polite"` force values on `aria-live-mode` and 
    `aria-live-interrupt` as follows:
    * `"assertive"` = `aria-live-mode="stack"` and `aria-live-interrupt="true"` and 
       `aria-live-interruptible="false"`
    * `"polite"` = = `aria-live-mode="queue"` and `aria-live-interrupt="false"` and 
       `aria-live-interruptible="true"`
    * Note: `"polite"` has the same defaults as `"custom"`.

These changes allow ARIA live regions to support new combinations of notification priority not 
possible to express with "assertive" and "polite". The aria-live names are just for fun, though
could be bikeshedded to express the behavior combinations if new ARIA attributes are discouraged:
* "bold" =  `aria-live-mode="stack"` and `aria-live-interrupt="false"`
* "persistent" =  `aria-live-mode="queue"` and `aria-live-interrupt="true"`
* "solo" =  `aria-live-mode="clear"` and either `aria-live-interrupt="true"` or `aria-live-interrupt="false"`

## Open Issues

### 1. Spamming mitigations

The general nature of a notification API means that authors could use it for scenarios 
that are already handled by screen readers (such as for focus-change actions) resulting 
in confusing double-announcements (in the worst case) or extra unwanted verbosity (in
the best case).

Note: screen readers will tune their behavior for the best customer experiences. 
Screen readers already add custom logic for handling app-and-site-specific scenarios
and are keen to extend that value to websites that make use of `ariaNotify`. For this
reason, known & popular sites that abuse `ariaNotify` can be mitigated at the screen
reader level without requiring particular mitigations in browsers. This does not
preclude mitigation strategies that UAs may to include.

Finally, malicious attackers can use the API as a Denial-of-Service against AT users.

Opportunities exist to mitigate against these approaches:
* making use of [User Activation](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation)
   primitives to limit usage of this API to only actions taken by the author
* global pending notification array limits. Apply a maximum threshold to the combined arrays 
   so that notification growth is not unbounded.
* time-gated use. Add a "cool down" timer between calls to the API so that notifications
   cannot be added to the queue in a tight loop. (This option may not be desirable as some
   scenarios may require frequent (but not sustained) pending notification array management.

## FAQ

### 1. Is this API going to lead to privacy concerns for AT users?

No. This API has been designed to be "write-only" meaning that its use shoudl have no other
apparent observable side-effects that could be used for fingerprinting.

See Security and Privacy section for additional details.

### 2. Are Element-level notifications really necessary?

Adding `ariaNotify` to Elements was driven by several goals:

* Resolve the question of how *language* input should be provided. To keep the API
   simple, we are able to leverage the `lang` attribute that is used to override
   the document language for specific subtrees. `ariaNotify` can use the nearest
   ancestor element's `lang` attribute as a language hint (or the document's 
   default language).
* Provide a simpler model for handling multiple queues. Being able to enqueue 
   notifications into separately-managed queues is an important scenario and would
   require explicit queue management if only a singleton `ariaNotify` existed on the
   document. By giving each node (elements + document) their own queue, the API can
   stay simple while enabling specific queue managment options.
* Screen readers can filter/prioritize notifications based on the 
   element associated with the notification queue. E.g., the element's current
   visibility in the User Agent, the element's proximity to the focused element.
   (Same potential options available with ARIA live regions today.)

### 3. Is the notification limited to plaintext strings as input?

For example, should the API allow for richer formatted text? Formatting could provide hints 
for expressiveness and pronounciation (TTML and WebVTT are potential candidates).
While we think Element-level context will help with some of the desired context, 
we aren't pursing a richer text format at this time.

### 5. Can this API allow for output verbosity preferences?

Screen reader users can customize the verbosity of the information (and context) that
is read to them via settings. Screen reader vendors can also adapt the screen reader
on a per site or per app basis for the best experience of their users. `ariaNotify`
offers labels as a mechanism to allow screen reader vendors or users to customize not
only the general use of `ariaNotify` on websites, but also individual notifications 
by label (or specific notification string instances in the limit).

### 6. Tooling help

It's very difficult today to test that ARIA live regions are working and how they are 
working. Tooling, 
[such as the work proposed here](https://docs.google.com/document/d/1ZRBC4VJwsb-dlLmcZJgYlz1qn7MmDwNKkyfbd8nbLEA/edit#),
should be available for content authors to validate the behavior of both ARIA live
regions and `ariaNotify`.

## Privacy and Security Considerations

1. **Timing.** The use of the API provides no return value, but parameters must still
    be processed. Implementations should take care to avoid optimizing-out the synchronous
    aspects of processing this API, as predictable timing differences from when the 
    API is "working" (a screen reader is connected) vs. "not working" (no screen reader
    connnected) could still be used to infer the presence of a user with an active screen
    reader.
2. **Readback.** Any readback of configuration settings for an screen reader via an API
    have the potential of exposing a connected (vs. not connected) screen reader, and as
    such is an easy target for fingerprinting screen reader users, an undesireable 
    outcome. Similarly, confirmation of notifications (such as via a fulfilled promise)
    have similar traits and are avoided in this proposal.
2. **Authoritative-sounding notifications.** Announcements could be crafted to deceive
    the user into thinking they are navigating trusted UI in the browser by arbitrarily 
    reading out control areas/names that match a particular target browser’s trusted UI.
     * Mitigations should be applied to suppress notifications when focus moves outside 
        of the web content.
     * Additional mitigations to block certain trusted phrases related to the browser's
        trusted UI could be considered.
     * Implementations may choose to audibly differentiate notification phrases coming 
        from `ariaNotify` in order to make it clear that they are content author controlled.        
3. **Secure Context**. Does it make sense to offer this feature only to Secure Contexts?
    Should usage of this API be automatically granted to 3rd party browsing contexts?
    Currently thinking "no" in order to have maximum possibility of reach within the 
    accessible community on all websites that should be made accessible, whether secure
    context-enabled or not.
4. **Data Limits** (See [Security and Privacy Questionnaire #2.7](https://www.w3.org/TR/security-privacy-questionnaire/#send-to-platform))
    Should there be a practical limit on the amount of text that can be sent in one parameter
    to the API? Just like multiple-call DoS attacks, one call with an enormous amount of
    text could tie up an AT or cause a hang as data is marshalled across boundaries.
    
## Alternative Solutions

The design of this API is loosely inspired by the [UIA Notification API](https://docs.microsoft.com/en-us/windows/win32/api/uiautomationcoreapi/nf-uiautomationcoreapi-uiaraisenotificationevent)).

Previous discussions for a Notifications API in the AOM and ARIA groups:
* [Issue 3 - Use Case: Accessibility Notifications](https://github.com/wicg/aom/issues/3)
* [Issue 84 - Live region properties vs announcement notification](https://github.com/WICG/aom/issues/84)
* [Issue 832 - Do we need a notifications API in ARIA](https://github.com/w3c/aria/issues/832)


