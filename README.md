# Church Locator widget

The Pages workflow deploys the latest successful `church-map-widget` build from the private `ACNAorg/church_locator` repository.

Set the Actions secret `CHURCH_LOCATOR_ARTIFACT_TOKEN` in this public repository to a fine-grained GitHub token scoped to the private source repository with **Actions: Read**. Keep GitHub Actions as the Pages source.

To update the live widget, manually run **Publish church locator** after a successful source refresh. The embed URL is <https://acnaorg.github.io/church_locator_widget/>.
