# A — Shell & navigation

Pass for domain **A**. Setup and progress: `[manual-test-overview.md](../manual-test-overview.md)`.


|                  |                                                                        |
| ---------------- | ---------------------------------------------------------------------- |
| **Acting users** | Logan Reed, then Alex Rivera (local stub picker)                       |
| **Depends on**   | Shared setup. Domain F covers the login screen and picker persistence. |


Confirm the shell chrome and that every page it can reach actually loads. Page content beyond “the right screen loaded” belongs to later domains. If a **Development** link is visible (`npm run dev`), leave it — that is domain **Q**.

Start as **Logan Reed** and run the desktop and mobile sections below. Then switch to **Alex Rivera**. The rail and the tab bar change with the user: Alex has no All Tasks, Users, Management, Crew map, or Billing. Switch back to Logan and those items return.

Above 1280px, the nav open/closed choice is stored for that tab (`sessionStorage`) and survives refresh and resize. At 1280px and below, refresh always starts the menu collapsed. Pin, dark mode, larger text, the task-type filter, and the selected user are stored on the device (`localStorage`). Pins and appearance are not reset when you switch users.


| View            | Width             | What you should see                                     |
| --------------- | ----------------- | ------------------------------------------------------- |
| Mobile          | under 768px       | No sidebar. Bottom tab bar. **More** at `/more`         |
| Desktop compact | 768px–1280px      | Icon rail. Open menu overlays the page                  |
| Desktop wide    | wider than 1280px | Same rail. Open menu pushes the page; no dimmed overlay |


A brand-new tab with no saved choice starts **closed** at 1280px and below, and **open** above 1280px.

---



## Desktop compact (768px–1280px)

Set the window to about 1100px, then open a **new tab** and load the app so the rail uses its default.

### Rail

- [ ] The rail is collapsed: icons only, page content is not pushed, no dimmed overlay.
- [ ] Hovering an icon shows its tooltip (My Tasks, All Tasks, Contacts, Addresses, Users, Management, Crew map, Find task, Settings).
- [ ] **Find task** opens the menu and focuses the search box.
- [ ] The menu button closes the menu. Opening it again shows labels, the search box, **Help**, **Legal**, and **Settings**.
- [ ] **Legal** opens a popover with **Terms** and **Privacy**.
- [ ] **Escape** closes the open menu. Clicking the dimmed overlay closes it too.
- [ ] Choosing a page link closes the menu and leaves the rail collapsed.
- [ ] Close the menu, refresh: it stays closed. Open it, refresh: it becomes closed.



### Pages from the rail

Open the menu, choose each link, and confirm the heading matches. The matching rail icon is the active one after you return.

- [ ] **My Tasks** → `/my-tasks`
- [ ] **All Tasks** → `/tasks`
- [ ] **Contacts** → `/contacts`
- [ ] **Addresses** → `/addresses`
- [ ] **Users** → `/users`
- [ ] **Management** → `/management`
- [ ] **Crew map** → `/crew-map`
- [ ] **Settings** → `/settings`

Settings opens on **Task lists** (not Account). The URL stays `/settings` while the section list switches. Each section shows its own action:

- [ ] **Account** — user picker reads Logan Reed
- [ ] **Appearance** — Dark mode and Larger text switches
- [ ] **Billing** — Open billing portal
- [ ] **Help** — Open help center
- [ ] **Privacy** — View privacy policy
- [ ] **Support** — Contact support
- [ ] **Task lists** — Show tasks of type
- [ ] **Terms** — View terms of service

Leave the external Help, Privacy, Terms, Billing, and Support targets. Confirm the button is there.

- [ ] There is no **Notifications** item in the rail. Going to `/notifications` directly loads Notifications, and no rail icon is active.



### Redirects

- [ ] `/` lands on `/my-tasks`
- [ ] `/more` lands on `/settings`
- [ ] `/does-not-exist` lands on `/my-tasks`



### Search

From the open rail, on any page:

- [ ] Search `99501` and submit. The task detail modal opens for that job. The address bar stays on the page you were on, and that page’s rail icon stays active.
- [ ] Close the modal.
- [ ] Search a value that matches nothing (for example `zzzz-no-such-task`). A not-found tooltip shows on the search box. The page does not change.
- [ ] Search `99252` and submit. A results list opens instead of the task. Columns are the external key, title, type, and created time. The search box at the top of the list shows the same text as the nav search box. Choosing a row opens that task on top of the list. Closing the task leaves the list open. Close, the X, a click outside, or Escape closes the list only when the list is the top modal. The search text stays in the box. These seed keys also open that list: `99301`, `99310`, `99322`, `99330`, `99401`, `99410`, `99418`, `99425`, `99433`.

---



## Desktop wide (wider than 1280px)

Keep the same tab. Widen the window past 1280px.

- [ ] If the menu was open, it stays open and **pushes** the page (the main area shifts right). There is no dimmed overlay. **Escape** does not close it.
- [ ] Choosing **Contacts** (or any other rail link) leaves the menu open.
- [ ] If the menu was closed, widening leaves it closed (a stored choice wins over the wide default).
- [ ] In a **new tab** opened already wider than 1280px, the menu starts open and pushes the page.
- [ ] Repeat one rail destination (All Tasks) and one Settings section (Appearance) at this width. Active icon, heading, and the open menu match the compact pass.

---



## Mobile (under 768px)

Narrow the same tab below 768px. The sidebar is gone. A bottom tab bar is the only nav.

### Tab bar

Default pins: Contacts on, Addresses off, All Tasks on.

- [ ] Tabs are **My Tasks**, **All Tasks**, **Contacts**, **More**, in that order, with icon and label.
- [ ] The tab for the current page is marked active.
- [ ] **My Tasks**, **All Tasks**, and **Contacts** each open that page. **More** opens `/more` with the heading More.
- [ ] **Addresses** is not a tab. It is listed under More → **Pages**.

More → **Tab bar** switches:

- [ ] Turn **Addresses** on: an Addresses tab appears, and Addresses leaves the Pages list. Turn it off: the tab goes away and the Pages link returns.
- [ ] Turn **Contacts** off: the Contacts tab goes away and Contacts appears under Pages. Turn it back on.
- [ ] Turn **All Tasks** off: that tab goes away and All Tasks appears under Pages. Turn it back on.
- [ ] **My Tasks** and **More** have no switch. They stay on the bar.
- [ ] Refresh. The pins you left on are still on.
- [ ] Widen past 768px: the desktop rail still shows My Tasks, All Tasks, Contacts, Addresses, Users, Management, Crew map, and Settings. Pins did not add or remove rail links. Narrow again: the tab bar matches the pins you saved.



### More page <768px

On `/more`, top to bottom:

- [ ] **Signed in as** shows the user picker, still Logan Reed
- [ ] **Task lists** — Show tasks of type
- [ ] **Task search**
- [ ] **Settings** — Dark mode and Larger text (these are switches on the page, not a section list)
- [ ] **Tab bar** — the three pin switches above
- [ ] **Pages** — only destinations that are not pinned, plus **Notifications**
- [ ] **Product** — Support, Help, Terms, Privacy, Billing

Users, Management, and Crew map are not in Pages on mobile web. They stay on the desktop rail.

- [ ] Pages → **Notifications** opens `/notifications`. No bottom tab is active.
- [ ] Back to More. Open **Addresses** from Pages (unpin it first if it is a tab). `/addresses` loads and the Addresses tab is active only when that pin is on.
- [ ] Direct `/users`, `/management`, and `/crew-map` still load for Logan, with the tab bar visible and no tab active.
- [ ] Direct `/settings` redirects to `/more`.
- [ ] Direct `/` lands on `/my-tasks`. Direct `/does-not-exist` lands on `/my-tasks`.



### Search

- [ ] More → Task search → `99501`. The mobile task view opens at `/task/99501` — the same screen as opening that task from My Tasks. The address bar is `/task/99501`, not the desktop detail modal.
- [ ] Back returns to `/more`. Search a value that matches nothing. A not-found tooltip shows, and the app stays on `/more`.
- [ ] More → Task search → `99252`. The same results list opens, still on `/more`. Choosing a row opens that task on the mobile task view (`/task/…`). Back returns to `/more`, and the list is closed. The search text stays in the box. These seed keys also open that list: `99301`, `99310`, `99322`, `99330`, `99401`, `99410`, `99418`, `99425`, `99433`.

---



## Same preferences on both views

Set these on desktop **Settings**, then narrow below 768px and confirm More and the tab bar. Then set them from More and widen to confirm the rail.

- [ ] **Dark mode** on: the shell is dark after refresh, on a rail page, and on More. Turn it off: light in both views.
- [ ] **Larger text** on: text is larger after refresh, in both views. Turn it off: normal size returns in both.
- [ ] Task lists → **Delivery** only: rail labels and tab labels become **My Deliveries** and **All Deliveries**, and the document title matches the page you are on. Refresh keeps the filter. Clear the filter: labels return to **My Tasks** and **All Tasks** in both views.

---



## Switch user

Leave **All Tasks** pinned, and the task-type filter cleared, before this section. Switch from **Settings → Account** on desktop, or **More → Signed in as** on mobile. Either one changes the user for both views.

### Alex Rivera

- [ ] Pick **Alex Rivera**. The picker shows that name. Refresh: it still shows Alex.
- [ ] Desktop rail, compact or wide: **My Tasks**, **Contacts**, **Addresses**, **Settings**. No **All Tasks**, **Users**, **Management**, or **Crew map**. Tooltips match that shorter set when the rail is collapsed.
- [ ] Each remaining rail link still opens its page, and that icon is active.
- [ ] Settings section list has no **Billing**. Account, Appearance, Help, Privacy, Support, Task lists, and Terms are still there.
- [ ] While Alex is selected, open `/tasks`, `/users`, `/management`, and `/crew-map` directly. Each one leaves that page and lands on `/my-tasks`.
- [ ] Mobile tabs: **My Tasks**, **Contacts**, **More**. No **All Tasks** tab, and More → Tab bar has no **Show All Tasks** switch. The Contacts and Addresses pin switches still work.
- [ ] More → **Product** has no **Billing**. Support, Help, Terms, and Privacy remain.
- [ ] More → **Pages** has no All Tasks, Users, Management, or Crew map. Notifications is still there.



### Back to Logan Reed

- [ ] Pick **Logan Reed**. Desktop rail shows **All Tasks**, **Users**, **Management**, and **Crew map** again. Settings shows **Billing** again.
- [ ] Mobile tabs include **All Tasks** again (the pin was left on). More → Tab bar shows the All Tasks switch. More → Product shows **Billing**.
- [ ] A pin you changed as Alex is still changed as Logan. Turn Addresses off if you turned it on, so the next pass starts from the default.