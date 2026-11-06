# Preserved working experiments

`working-demos.zip` is the complete working draft saved before the experiments were hidden. It includes the pendulum, neuron, scripts, styles, and profile image.

The current main page retains the full experiment markup inside an HTML comment. The `experiments.js` script import is also commented out, so neither widget loads or runs. Its implementation and supporting styles remain intact.

To restore the widgets in the current design:
1. In `index.html`, remove the comment wrapper beginning `WORKING DEMOS PRESERVED` and ending `END PRESERVED DEMOS`.
2. Uncomment the `experiments.js` script tag near the end of `index.html`.

The ambient background is separate from those widgets. Its three modes depict illustrative routes, synthetic population spike events, and uncertain observations. It uses original artwork and synthetic data.

The main page currently also comments out the ambient background container, footer controls, and `neural-background.js` import. Their full implementations remain present; uncomment those three blocks to restore the backgrounds.
