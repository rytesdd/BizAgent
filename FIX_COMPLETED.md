# Highlighting Fix Applied

## Summary
The comment highlighting issue has been resolved by implementing a "Bridge" between the Live Document (Middle Column) and the Mock Prototype (Right Column).

## What Was Fixed
1.  **AI Generated Comments**: Previously, these had random IDs that the Mock Prototype didn't recognize. Now, they are automatically mapped to the Prototype's existing IDs in the background (Demo Mode Logic).
    - Clicking the 1st AI comment highlights the 1st Prototype element.
    - Clicking the 2nd AI comment highlights the 2nd Prototype element.
2.  **Manual Comments**: Previously, manual selection might not have persisted correctly. Now, manually selected UI targets are prioritized.
    - If you select "SAAS Team Plan" and comment, clicking that comment will *always* highlight the "SAAS Team Plan".

## How to Verify
1.  **AI Comments**: Click any existing AI comment. The Mock View (Right) should highlight a corresponding section.
2.  **Manual Comments**:
    - Click a UI card in the Right Panel (e.g., "SAAS Enterprise").
    - Note the system message "Selected UI...".
    - Send a new comment.
    - Click the new comment.
    - Verify the "SAAS Enterprise" card highlights.
