**Serenitype**

A minimalist, zen-inspired typing speed test game with dynamic themes, parallax particle backgrounds, and real-time WPM & accuracy tracking.

## 🎮 Demo

Load directly by visiting `index.html` in your browser or deploying to GitHub Pages/Netlify:

```
https://<your-username>.github.io/<your-repo>/
```

## 🚀 Features

* **Dynamic Themes**: Cycle through multiple color gradients by pressing **Space** on the title screen.
* **Parallax Particles**: Three canvas layers create a depth effect.
* **Zen Modes**: Smooth fade-ins/fade-outs, breathing text animations.
* **Real-time Stats**: WPM (words per minute) and accuracy updated live as you type.
* **Audio Ambience**: Looping background track with mute/unmute toggle.

## 📁 Directory Structure

```
serenitype/             # Repo root
├── index.html         # Main game HTML + inline CSS & JS
├── ambient.mp3        # Background music
├── .nojekyll          # (Optional) disables Jekyll on GitHub Pages
├── assets/            # Optional: external assets (images, fonts)
└── README.md          # This file
```

> All asset references in `index.html` are relative to the root.

## 🛠️ Getting Started

1. **Clone the repo**

   ```bash
   git clone https://github.com/<your-username>/serenitype.git
   cd serenitype
   ```

2. **Run locally** (to avoid CORS issues)

   ```bash
   # Python 3 built-in server
   python3 -m http.server 8000

   # or Node.js http-server
   npx http-server -c-1
   ```

   Then open `http://localhost:8000`.

3. **Deploy**

   * **GitHub Pages**: Push to `main`, enable Pages in Settings (source: `/`).
   * **Netlify / Vercel**: Drag-and-drop or connect the GitHub repo.

## 🎨 Customization

* **Themes**: Edit the `themes` object in the `<script>` block to add/remove gradients or adjust colors.
* **Text Prompts**: Modify the `texts` array to change typing passages.
* **Audio**: Replace `ambient.mp3` or adjust `bgMusic.volume` in JS.

## 🔧 Configuration

* **Disable Jekyll**: If your Pages site shows `README.md` instead of the game, add a blank `.nojekyll` file.
* **Custom Domain**: Create a `CNAME` file containing your domain name, and configure DNS accordingly.

## 🤝 Contributing

1. Fork the repo
2. Create a new branch (`git checkout -b feature/YourFeature`)
3. Make your changes & commit (`git commit -m 'Add new feature'`)
4. Push to your branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

Please adhere to existing code style and include clear commit messages.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

*Built with 💜 by Alex.*
