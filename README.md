# CROSSROADS — Gameplay 2.4A+B

Staged MMG fixed-weapon doctrine and presentation.

## Quality cleanup

The large quality cards are replaced by edge stripes:

- 1 orange stripe — Inexperienced
- 2 yellow stripes — Regular
- 3 green stripes — Veteran

## 2.4A — MMG doctrine

- MMGs begin packed.
- The first Fire order deploys the MMG and consumes the activation.
- Deployed MMGs may Fire or use Ambush.
- Run or Advance packs the MMG.
- 3 crew: 5 shots.
- 2 crew: 2 shots.
- 1 crew: cannot fire.
- Advance never permits MMG fire.

## 2.4B — Facing and field of fire

- A selected deployed MMG shows a 90° field-of-fire arc.
- MMGs show PACKED / DEPLOYED and a facing arrow.
- Mobile controls provide Face ◀ and Face ▶ in 45° steps.
- Normal Fire may traverse toward the chosen target.
- Ambush is restricted to the current arc.

Upload every file to the repository root and wait until the badge says
`Gameplay 2.4A+B`.

Recommended tests:

1. Confirm an undeployed MMG shows Deploy MMG instead of Fire.
2. Deploy and verify the activation ends.
3. On a later activation, rotate and Fire.
4. Set Ambush, then move enemies inside and outside the arc.
5. Run or Advance and verify PACKED.
6. Test at 3, 2, and 1 surviving crew.
7. Confirm quality uses compact colored stripes.
