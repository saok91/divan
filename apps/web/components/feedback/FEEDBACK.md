# Feedback precedence (UX-DR39 / Story 8.8)

One user-visible outcome uses **exactly one** channel.

| Event type | Channel |
| --- | --- |
| Field validation / form save / row commit | **Inline** (`FeedbackMessage`, form footer, field `role="alert"`) |
| Import execute / export job / long recompute | **Toast** (`toastBackground` + link back to the work) |
| Staleness / break-glass / integrity degraded | **Banner** (`BannerStack`) |

## Hard rules

- **Optimistic nothing:** never report success before server confirmation.
- **In-place pending:** keep the surface mounted; `aria-busy` + disable submit. Do not swap an in-session filter/save surface for a cold-load skeleton.
- **Cold load only:** content-shaped skeletons for first paint of known-shaped tables/panels.
- Toast is **illegal** for ordinary form/row save.
- Do not toast what banners already announce.
- Leave-guard dialog remains its own channel (not a toast substitute).
- Destructive / sensitive confirmation posture (Epic 2/4) is unchanged.
