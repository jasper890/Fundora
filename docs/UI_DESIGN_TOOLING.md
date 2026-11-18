# UI design tooling

## DaisyUI skill

The official daisyUI 5.7.x Codex skill and its component references live in `.agents/skills/daisyui/`. The skill is agent guidance only. Fundora uses Next.js and project CSS. The app does not install Tailwind CSS or daisyUI. Do not emit daisyUI classes or switch the app's styling stack until the runtime dependencies are intentionally added.

## Figma MCP

The project config in `.codex/config.toml` points Codex to Figma's official remote MCP server at `https://mcp.figma.com/mcp`. Each contributor must trust the repository in Codex and authorize their own Figma account through the browser. OAuth credentials are per-user and must not be committed. This project config makes the server available; it does not mean the current user's account is authenticated.

The ChatGPT Figma connector and the Codex CLI MCP are separate connections. Before this config was added, `codex mcp list` had no Figma entry. After adding it, run `codex mcp login figma` from a trusted project session (or authorize when Codex prompts), then confirm Figma is listed and connected.

## Apple design reference

Fundora is a web app. Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) can inform clear hierarchy, accessible controls, concise feedback, and mobile ergonomics. Apple's downloadable [iOS and iPadOS UI Kit](https://developer.apple.com/design/resources/) is licensed for mockups of software that runs on Apple operating systems; its license does not allow using those assets for a web app mockup or embedding them in a web product. Do not copy its components, icons, fonts, or other assets into Fundora. If a separate native iOS product is designed later, use the official Figma kit under its license.

## Figma Action request

`primer/figma-action@v1.0.0-alpha.2` is not an MCP server. Its upstream repository was archived in 2020, and the requested tag contains no `action.yml`, so GitHub Actions cannot load it as an action. The implementation also uses Node 10 and old dependencies. No broken workflow was added. Use the official Figma MCP for design context; choose a maintained asset-export method only if the project later needs automated exports.
