# Mobile fullscreen modals

`KeyboardAwareModal` sets Mantine `fullScreen` below `AG_GRID_MOBILE_MQ`.

Do not set `height: 100% !important` on `.field-mobile-fullscreen-modal` (or task/pin modal classes). The modal **inner** wrapper has no explicit height, so percentage height collapses the panel while the overlay stays visible (looks like a black screen). Use `100dvh` if a CSS override is needed.
