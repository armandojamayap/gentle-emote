# Streamer talk scene (backup)

The talk state used to be a livestream: headphones, a podcast mic and an ON AIR sign.
Those four frames, for both the normal set and the YOLO twin, are in this folder.

`preview.png` is a contact sheet of the normal set.

To bring the scene back, copy each folder's PNGs over `emotes/gentleman/talk/` and
`emotes/gentleman-yolo/talk/`, and restore the `talk` drawing block in
`scripts/sprites/build.ts` from the commit that archived this folder.
The next `npm run sprites` would otherwise overwrite the copies.
