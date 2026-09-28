# Analytics Data Contract

## 1. Purpose

This document defines the data contract for anonymous user interaction analytics in the LPL visualization project.

The analytics system is designed to help us understand:

* how users interact with the visualization;
* which features are used;
* which UI elements receive attention;
* how users navigate and compare information;
* how the interface can be improved based on actual usage.

The system does **not** collect personally identifiable information.

The initial implementation focuses on a small number of meaningful semantic events rather than tracking every user action.

---

## 2. IDs

### 2.1 Anonymous Identity

Each browser receives a randomly generated `anonymous_id`.

* Generated with `crypto.randomUUID()`.
* Stored in `localStorage`.
* Persists across page refreshes, hard reloads, browser restarts, and future visits.
* Different origins have different identities.
* The ID does not contain or encode personal information.


### 2.2 Session Identity

Each browsing session receives a randomly generated `session_id`.

* Generated with `crypto.randomUUID()`.
* Stored in `sessionStorage`.
* Persists across refreshes and hard reloads within the same browser tab/session.
* A new session receives a new `session_id`.

This allows us to distinguish:

* repeated visits from the same anonymous browser;
* different sessions from the same anonymous browser.

---

## 3. Developer / Test Mode

The application supports a local developer mode for internal testing.

When developer mode is enabled:

```text
is_test = true
```

Otherwise:

```text
is_test = false
```

Developer mode is currently activated through the existing hidden interaction on the homepage status indicator.

The developer mode state is persisted in `localStorage`.

### Important

`is_test` is an analytics classification field, **not a security mechanism**.

---

# 4. Event Model

The analytics system uses a small semantic event vocabulary.

The initial event types are:

```text
click
tooltip_open
search_open
filter_change
sort_change
```

---

## 5. Event Types

### 5.1 `click`

Records a meaningful click on an interactive visualization or UI element.

Examples:

* clicking a team card;
* clicking a player card;
* clicking a lineup card;
* clicking a team/member link;
* clicking a comparison selector;
* clicking a comparison target;
* clicking a navigation button.

Example:

```json
{
  "event_name": "click",
  "page": "catalogue",
  "target_type": "team_card",
  "target_id": "BLG"
}
```

Another example:

```json
{
  "event_name": "click",
  "page": "comparison",
  "target_type": "player_selector",
  "target_id": "player_123"
}
```

The same `click` event can represent different interactions through `target_type` and `target_id`.

---

### 5.2 `tooltip_open`

Records when a user opens a meaningful data tooltip.

Examples:

* opening a pair-impact tooltip;
* opening a chart data-point tooltip;
* opening an explanatory visualization tooltip.

Example:

```json
{
  "event_name": "tooltip_open",
  "page": "player",
  "target_type": "pair_impact",
  "target_id": "player_123_player_456"
}
```

We do not record continuous mouse movement or cursor coordinates.

---

### 5.3 `search_open`

Records when a search interface is opened or activated.

Example:

```json
{
  "event_name": "search_open",
  "page": "comparison",
  "target_type": "player_search"
}
```

The initial implementation records that the search function was opened, rather than recording every keystroke.

We should **not** collect raw search input unless a future analytics requirement explicitly justifies it and the data collection is reviewed separately.

---

### 5.4 `filter_change`

Records a meaningful change to a filter.

Examples:

* changing the season filter;
* changing a team filter;
* changing another visualization-level filter.

Example:

```json
{
  "event_name": "filter_change",
  "page": "game_catalogue",
  "target_type": "patch_filter",
  "metadata": {
    "from": "15.1",
    "to": "15.2"
  }
}
```

The exact metadata depends on the filter.

---

### 5.5 `sort_change`

Records a change to the sorting order of a table or list.

Example:

```json
{
  "event_name": "sort_change",
  "page": "game_catalogue",
  "target_type": "Date",
  "metadata": {
    "changed to": "newest first"
  }
}
```

Sorting is treated as one general event type rather than creating a separate event for every sortable field.

---

# 6. Database Schema

The initial database contains only one table:

```text
events
```

Schema:

| Field          | Type        | Required | Description                                       |
| -------------- | ----------- | -------: | ------------------------------------------------- |
| `event_id`     | UUID        |      Yes | Unique identifier for the event                   |
| `anonymous_id` | UUID        |      Yes | Anonymous browser identifier                      |
| `session_id`   | UUID        |      Yes | Current session identifier                        |
| `timestamp`    | TIMESTAMPTZ |      Yes | Time at which the event was recorded              |
| `event_name`   | TEXT        |      Yes | Semantic event type                               |
| `page`         | TEXT        |       No | Page where the event occurred                     |
| `target_type`  | TEXT        |       No | Type of UI/data object involved                   |
| `target_id`    | TEXT        |       No | Identifier of the specific target                 |
| `is_test`      | BOOLEAN     |      Yes | Whether the event was generated in developer mode |
| `metadata`     | JSONB       |       No | Additional event-specific information             |

---

# 7. Example Events

### Team Card Click

```json
{
  "event_name": "click",
  "page": "catalogue",
  "target_type": "team_card",
  "target_id": "BLG",
  "is_test": false
}
```

### Player Card Click

```json
{
  "event_name": "click",
  "page": "catalogue",
  "target_type": "player_card",
  "target_id": "player_123",
  "is_test": false
}
```

### Search Open

```json
{
  "event_name": "search_open",
  "page": "catalogue",
  "target_type": "player_search",
  "is_test": false
}
```

### Filter Change

```json
{
  "event_name": "filter_change",
  "page": "catalogue",
  "target_type": "season_filter",
  "is_test": false,
  "metadata": {
    "from": "2026",
    "to": "2025"
  }
}
```

### Sort Change

```json
{
  "event_name": "sort_change",
  "page": "catalogue",
  "target_type": "player_table",
  "is_test": false,
  "metadata": {
    "field": "win_rate",
    "order": "desc"
  }
}
```

### Comparison Interaction

```json
{
  "event_name": "click",
  "page": "comparison",
  "target_type": "player_selector",
  "target_id": "player_123",
  "is_test": false
}
```

---

# 8. Data Collection Boundaries

The analytics system should **not** collect any private personal information.

The system should focus on meaningful semantic interactions.

---

# 9. Data Flow

```text
User interaction
       ↓
Semantic event
       ↓
trackEvent()
       ↓
Analytics context
├── anonymous_id
├── session_id
├── timestamp
└── is_test
       ↓
Supabase Data API
       ↓
PostgreSQL
       ↓
events
```

The UI should call a centralized `trackEvent()` function rather than directly inserting data into Supabase.

For example:

```javascript
trackEvent({
  event_name: "click",
  page: "catalogue",
  target_type: "team_card",
  target_id: "BLG"
});
```

`trackEvent()` is responsible for adding the common analytics context.

This keeps the UI components independent from the database implementation.

---

# 10. Database Security

The frontend will use the Supabase public/anonymous key.

The `service_role` key must **never** be included in frontend code.

Row Level Security (RLS) should be enabled for the `events` table.

For anonymous visitors, the initial policy should be:

```text
INSERT    allowed
SELECT    denied
UPDATE    denied
DELETE    denied
```

The purpose is to allow the visualization to submit analytics events without exposing the entire analytics dataset to public visitors.

---

# 11. Initial Database Scope

The first version should contain only:

```text
events
```

Do not create separate tables for:

```text
users
sessions
experiments
recommendations
user_profiles
```

at this stage.

`anonymous_id` and `session_id` are sufficient for the initial analytics requirements.

Additional tables can be introduced later if the project develops more advanced analytics features.

---

# 12. Future Extensions

The current event model is intentionally minimal but extensible.

Potential future uses include:

* navigation pattern analysis;
* feature usage analysis;
* comparison behavior analysis;
* UI redesign evaluation;
* A/B testing;
* recommendation systems;
* personalization;
* identifying frequently used or ignored features;
* measuring changes in interaction patterns after UI updates.

New event types should only be introduced when the existing semantic event model cannot represent the required behavior clearly.

The goal is to keep the event taxonomy small, stable, and meaningful.
