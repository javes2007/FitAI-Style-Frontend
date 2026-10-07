# FitAI human avatar asset

FitAI V6 loads a real parametric human GLB from a pinned jsDelivr mirror of the open-source three.ws parametric avatar base.

Source:
- Repository: https://github.com/nirholas/three.ws
- Asset: public/avatars/parametric-base.glb
- Pinned commit: 5c7d87a768152cd64a8cce2feef8831411062eb5
- Shape data provenance: Anny / MakeHuman / MPFB2, with CC0 shape assets as documented by the source project.

The runtime URL is pinned in js/avatar3D.js so the model does not silently change.

The model is a rigged humanoid with morph targets for facial/body proportions. FitAI maps its morphs to the editor sliders and combines them with skeletal proportion changes for the 0-100 age control.

Important limitation:
- This is a parametric human base, not a photogrammetric scan and not a photo-identical reconstruction of a real person.
- The current browser pipeline approximates infant/child proportions using the rig plus the available age/body morphs. A true infant-to-elder all-age mesh should be generated from the full Anny all-age model on the backend when that pipeline is added.

If a local human-base.glb is added later, avatar3D.js can be switched back to a local asset without changing the editor API.