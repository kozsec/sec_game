(() => {
  "use strict";

  const SAVE_KEY = "cyber-pair-save-v1";

  const el = (id) => document.getElementById(id);
  const background = el("background");
  const dialogueText = el("dialogue-text");
  const speakerLine = el("speaker-line");
  const speakerName = el("speaker-name");
  const speakerBar = el("speaker-bar");
  const choices = el("choices");
  const menuPanel = el("menu-panel");
  const videoLayer = el("video-layer");
  const video = el("scene-video");

  let storyData;
  let characters;
  let currentNodeId;
  let currentNode;
  let activeCharacters = { left: null, right: null };
  let toastTimer;

  async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} を読み込めませんでした (${response.status})`);
    return response.json();
  }

  function showToast(message) {
    const toast = el("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function saveProgress() {
    if (!currentNodeId) return;
    const payload = {
      nodeId: currentNodeId,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      el("save-status").textContent = `自動保存済み：${new Date(payload.savedAt).toLocaleString("ja-JP")}`;
    } catch (error) {
      el("save-status").textContent = "保存できませんでした。ブラウザの保存設定をご確認ください。";
    }
  }

  function loadProgress(showMessage = true) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        if (showMessage) showToast("保存データがありません。");
        return false;
      }
      const saved = JSON.parse(raw);
      if (!saved.nodeId || !storyData.nodes[saved.nodeId]) {
        if (showMessage) showToast("保存データを読み込めませんでした。");
        return false;
      }
      renderNode(saved.nodeId);
      if (showMessage) showToast("保存データから再開しました。");
      return true;
    } catch (error) {
      if (showMessage) showToast("保存データを読み込めませんでした。");
      return false;
    }
  }

  function assetUrl(path) {
    if (!path) return "";
    return encodeURI(path);
  }

  function setBackground(path) {
    if (!path) return;
    background.style.backgroundImage = `url("${assetUrl(path)}")`;
  }

  function renderCharacter(slotName, characterId) {
    const slot = el(`character-${slotName}`);
    slot.replaceChildren();
    slot.classList.remove("is-hidden");

    if (!characterId || !characters[characterId]) return;
    const character = characters[characterId];
    const imagePath = slotName === "left" ? character.leftImage : character.rightImage;
    if (!imagePath) return;

    const image = document.createElement("img");
    image.src = assetUrl(imagePath);
    image.alt = character.name || characterId;
    image.addEventListener("error", () => {
      image.remove();
      console.warn(`キャラクター画像を読み込めません: ${imagePath}`);
    }, { once: true });
    slot.append(image);
  }

  function applyAudio(node) {
    if (node.music) {
      const audio = getMusicElement();
      const source = assetUrl(node.music);
      if (audio.dataset.src !== source) {
        audio.pause();
        audio.src = source;
        audio.dataset.src = source;
        audio.currentTime = 0;
      }
      audio.play().catch(() => {});
    }
    if (node.sound) playSound(node.sound);
  }

  let musicElement;
  function getMusicElement() {
    if (!musicElement) {
      musicElement = new Audio();
      musicElement.loop = true;
      musicElement.volume = 0.42;
    }
    return musicElement;
  }

  function playSound(path) {
    const audio = new Audio(assetUrl(path));
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }

  function openVideo(path) {
    if (!path) return;
    video.src = assetUrl(path);
    videoLayer.hidden = false;
    video.play().catch(() => {});
  }

  function closeVideo() {
    video.pause();
    video.removeAttribute("src");
    video.load();
    videoLayer.hidden = true;
  }

  function renderNode(nodeId) {
    const node = storyData.nodes[nodeId];
    if (!node) {
      showToast(`シナリオの参照先が見つかりません: ${nodeId}`);
      return;
    }

    currentNodeId = nodeId;
    currentNode = node;

    if (node.background) setBackground(node.background);
    if (node.characters) {
      if (Object.prototype.hasOwnProperty.call(node.characters, "left")) activeCharacters.left = node.characters.left;
      if (Object.prototype.hasOwnProperty.call(node.characters, "right")) activeCharacters.right = node.characters.right;
    }
    renderCharacter("left", activeCharacters.left);
    renderCharacter("right", activeCharacters.right);

    const speakerId = node.speaker;
    if (!speakerId || speakerId === "narration") {
      speakerLine.hidden = true;
      speakerName.textContent = "";
      speakerBar.style.backgroundColor = "transparent";
      document.documentElement.style.setProperty("--speaker-color", "#67d5ff");
    } else {
      const character = characters[speakerId];
      speakerLine.hidden = false;
      speakerName.textContent = character?.name || speakerId;
      const color = character?.color || "#67d5ff";
      speakerBar.style.backgroundColor = color;
      document.documentElement.style.setProperty("--speaker-color", color);
    }

    dialogueText.textContent = node.text || "";
    el("scene-label").textContent = node.episodeLabel || storyData.episodeLabel || "STORY";
    choices.replaceChildren();
    choices.hidden = !Array.isArray(node.choices) || node.choices.length === 0;

    if (Array.isArray(node.choices)) {
      for (const choice of node.choices) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-button";
        button.textContent = choice.text;
        button.addEventListener("click", () => {
          if (choice.reset) {
            renderNode(storyData.start);
          } else if (choice.end) {
            dialogueText.textContent = "プレイありがとうございました。メニューから保存データを再開できます。";
            choices.hidden = true;
            currentNodeId = nodeId;
            saveProgress();
          } else {
            renderNode(choice.next);
          }
        });
        choices.append(button);
      }
    }

    if (node.video) openVideo(node.video);
    if (node.sound || node.music) applyAudio(node);
    saveProgress();
  }

  function toggleCharacter(side) {
    if (side === "left") leftVisible = !leftVisible;
    if (side === "right") rightVisible = !rightVisible;
    renderCharacter("left", activeCharacters.left);
    renderCharacter("right", activeCharacters.right);
    saveSettings();
    saveProgress();
    showToast(`${side === "left" ? "左" : "右"}のキャラクターを${(side === "left" ? leftVisible : rightVisible) ? "表示" : "非表示"}にしました。`);
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ leftVisible, rightVisible }));
    } catch (error) {}
  }

  function loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      leftVisible = settings.leftVisible !== false;
      rightVisible = settings.rightVisible !== false;
    } catch (error) {
      leftVisible = true;
      rightVisible = true;
    }
  }

  el("scene").addEventListener("click", (event) => {
    if (event.target.closest("button, .choices, .menu-panel, .video-layer")) return;
    if (!menuPanel.hidden || !videoLayer.hidden) return;
    if (!choices.hidden) return;
    if (currentNode?.advanceMode === "target") return;
    if (currentNode?.next) renderNode(currentNode.next);
  });

  el("menu-button").addEventListener("click", () => {
    menuPanel.hidden = !menuPanel.hidden;
  });
  el("close-menu").addEventListener("click", () => { menuPanel.hidden = true; });
  el("save-button").addEventListener("click", () => { saveProgress(); showToast("進行状況を保存しました。"); });
  el("load-button").addEventListener("click", () => loadProgress(true));
  el("restart-button").addEventListener("click", () => {
    const confirmed = window.confirm("最初から始めますか？ 現在の保存データは新しい進行状況で上書きされます。");
    if (confirmed) {
      renderNode(storyData.start);
      menuPanel.hidden = true;
      showToast("最初から開始しました。");
    }
  });
  el("close-video").addEventListener("click", closeVideo);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menuPanel.hidden = true;
      if (!videoLayer.hidden) closeVideo();
    } else if ((event.key === "Enter" || event.key === " ") && document.activeElement === document.body) {
      if (!choices.hidden) return;
      if (currentNode?.advanceMode === "target") return;
      if (currentNode?.next) renderNode(currentNode.next);
    }
  });

  async function init() {
    try {
      [storyData, characfters] = await Promise.all([
        loadJson("data/story.json"),
        loadJson("data/characters.json")
      ]);
      if (!loadProgress(false)) renderNode(storyData.start);
    } catch (error) {
      dialogueText.textContent = `ゲームデータの読み込みに失敗しました。\n${error.message}\n\nGitHub PagesまたはローカルWebサーバー経由で開いてください。`;
      nextButton.hidden = true;
      speakerLine.hidden = true;
      console.error(error);
    }
  }

  init();
})();
