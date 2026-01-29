// Stream Page - Vanilla JS Version
// Converted from React component

class StreamPage {
  constructor(streamId) {
    this.streamId = streamId;

    // Device states
    this.cameras = [];
    this.microphones = [];
    this.selectedCamera = "";
    this.selectedMicrophone = "";

    // Stream states
    this.isStreaming = false;
    this.hasPermission = false;
    this.isLoading = true;
    this.error = null;

    // UI states
    this.mounted = false;
    this.showSettings = false;

    // Refs
    this.videoElement = null;
    this.stream = null;

    // DOM elements cache
    this.elements = {};

    this.init();
  }

  init() {
    this.render();
    this.cacheElements();
    this.bindEvents();
    this.initializeDevices();

    // Trigger mounted animation
    requestAnimationFrame(() => {
      this.mounted = true;
      this.updateMountedStyles();
    });
  }

  cacheElements() {
    this.elements = {
      root: document.getElementById("stream-root"),
      videoContainer: document.getElementById("video-container"),
      video: document.getElementById("preview-video"),
      loadingState: document.getElementById("loading-state"),
      permissionState: document.getElementById("permission-state"),
      liveBadge: document.getElementById("live-badge"),
      settingsPanel: document.getElementById("settings-panel"),
      bottomControls: document.getElementById("bottom-controls"),
      cameraSelect: document.getElementById("camera-select"),
      microphoneSelect: document.getElementById("microphone-select"),
      settingsBtn: document.getElementById("settings-btn"),
      streamBtn: document.getElementById("stream-btn"),
      flipBtn: document.getElementById("flip-btn"),
      errorContainer: document.getElementById("error-container"),
      errorMessage: document.getElementById("error-message"),
      retryBtn: document.getElementById("retry-btn"),
      allowBtn: document.getElementById("allow-btn"),
    };
    this.videoElement = this.elements.video;
  }

  bindEvents() {
    this.elements.allowBtn?.addEventListener("click", () =>
      this.initializeDevices()
    );
    this.elements.retryBtn?.addEventListener("click", () =>
      this.initializeDevices()
    );
    this.elements.settingsBtn?.addEventListener("click", () =>
      this.toggleSettings()
    );
    this.elements.streamBtn?.addEventListener("click", () =>
      this.toggleStream()
    );
    this.elements.flipBtn?.addEventListener("click", () => this.flipCamera());
    this.elements.cameraSelect?.addEventListener("change", (e) => {
      this.selectedCamera = e.target.value;
      this.startPreview();
    });
    this.elements.microphoneSelect?.addEventListener("change", (e) => {
      this.selectedMicrophone = e.target.value;
      this.startPreview();
    });
  }

  async initializeDevices() {
    this.isLoading = true;
    this.error = null;
    this.updateUI();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });

      stream.getTracks().forEach((track) => track.stop());
      this.hasPermission = true;

      const devices = await navigator.mediaDevices.enumerateDevices();

      this.cameras = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Câmera ${index + 1}`,
        }));

      this.microphones = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microfone ${index + 1}`,
        }));

      if (this.cameras.length > 0) {
        const frontCamera = this.cameras.find(
          (d) =>
            d.label.toLowerCase().includes("front") ||
            d.label.toLowerCase().includes("frontal") ||
            d.label.toLowerCase().includes("user")
        );
        this.selectedCamera =
          frontCamera?.deviceId || this.cameras[0].deviceId;
      }

      if (this.microphones.length > 0) {
        this.selectedMicrophone = this.microphones[0].deviceId;
      }

      this.populateSelects();
      await this.startPreview();
    } catch (err) {
      console.error("Error accessing media devices:", err);
      this.error = "Permissão negada";
      this.hasPermission = false;
    } finally {
      this.isLoading = false;
      this.updateUI();
    }
  }

  populateSelects() {
    const cameraSelect = this.elements.cameraSelect;
    const micSelect = this.elements.microphoneSelect;

    if (cameraSelect) {
      cameraSelect.innerHTML = this.cameras
        .map(
          (cam) =>
            `<option value="${cam.deviceId}" class="bg-black text-white">${cam.label}</option>`
        )
        .join("");
      cameraSelect.value = this.selectedCamera;
    }

    if (micSelect) {
      micSelect.innerHTML = this.microphones
        .map(
          (mic) =>
            `<option value="${mic.deviceId}" class="bg-black text-white">${mic.label}</option>`
        )
        .join("");
      micSelect.value = this.selectedMicrophone;
    }
  }

  async startPreview() {
    if (!this.selectedCamera || !this.hasPermission) return;

    try {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: this.selectedCamera
            ? { exact: this.selectedCamera }
            : undefined,
          facingMode: "user",
        },
        audio: {
          deviceId: this.selectedMicrophone
            ? { exact: this.selectedMicrophone }
            : undefined,
        },
      });

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
      }
    } catch (err) {
      console.error("Error starting preview:", err);
      this.error = "Erro na câmera";
      this.updateUI();
    }
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
    this.updateUI();
  }

  toggleStream() {
    this.isStreaming = !this.isStreaming;
    this.updateUI();
  }

  flipCamera() {
    if (this.cameras.length < 2) return;
    const currentIndex = this.cameras.findIndex(
      (c) => c.deviceId === this.selectedCamera
    );
    const nextIndex = (currentIndex + 1) % this.cameras.length;
    if (this.cameras[nextIndex]) {
      this.selectedCamera = this.cameras[nextIndex].deviceId;
      if (this.elements.cameraSelect) {
        this.elements.cameraSelect.value = this.selectedCamera;
      }
      this.startPreview();
    }
  }

  updateMountedStyles() {
    const permissionState = this.elements.permissionState;
    const liveBadge = this.elements.liveBadge;
    const bottomControls = this.elements.bottomControls;
    const settingsPanel = this.elements.settingsPanel;

    if (permissionState) {
      permissionState.style.opacity = this.mounted ? "1" : "0";
      permissionState.style.transform = this.mounted
        ? "scale(1)"
        : "scale(0.9)";
    }

    if (liveBadge) {
      liveBadge.style.opacity = this.mounted ? "1" : "0";
      liveBadge.style.transform = this.mounted
        ? "translateY(0)"
        : "translateY(-20px)";
    }

    if (bottomControls) {
      bottomControls.style.opacity = this.mounted ? "1" : "0";
      bottomControls.style.transform = this.mounted
        ? "translateY(0)"
        : "translateY(100%)";
    }

    if (settingsPanel) {
      settingsPanel.style.opacity = this.mounted ? "1" : "0";
      settingsPanel.style.transform = this.mounted
        ? "translateY(0)"
        : "translateY(-20px)";
    }
  }

  updateUI() {
    // Loading state
    if (this.elements.loadingState) {
      this.elements.loadingState.style.display = this.isLoading
        ? "flex"
        : "none";
    }

    // Permission state
    if (this.elements.permissionState) {
      this.elements.permissionState.style.display =
        !this.isLoading && !this.hasPermission ? "flex" : "none";
    }

    // Video
    if (this.elements.video) {
      this.elements.video.style.display =
        !this.isLoading && this.hasPermission ? "block" : "none";
    }

    // Live badge
    if (this.elements.liveBadge) {
      this.elements.liveBadge.style.display = this.isStreaming
        ? "block"
        : "none";
    }

    // Settings panel
    if (this.elements.settingsPanel) {
      this.elements.settingsPanel.style.display =
        this.showSettings && this.hasPermission ? "block" : "none";
    }

    // Settings button style
    if (this.elements.settingsBtn) {
      this.elements.settingsBtn.disabled = !this.hasPermission;
      if (this.showSettings) {
        this.elements.settingsBtn.className =
          "w-14 h-14 flex items-center justify-center border-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-[#CCFF00] border-[#CCFF00] text-black";
      } else {
        this.elements.settingsBtn.className =
          "w-14 h-14 flex items-center justify-center border-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-black/60 border-white/50 text-white hover:bg-black/80 hover:border-white";
      }
    }

    // Stream button
    if (this.elements.streamBtn) {
      this.elements.streamBtn.disabled = !this.hasPermission || this.isLoading;
      if (this.isStreaming) {
        this.elements.streamBtn.className =
          "flex-1 h-14 flex items-center justify-center gap-3 border-2 font-mono text-sm font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-red-500 border-red-500 text-white hover:bg-red-600";
        this.elements.streamBtn.innerHTML = `
          <div class="w-4 h-4 bg-white"></div>
          <span>PARAR</span>
        `;
      } else {
        this.elements.streamBtn.className =
          "flex-1 h-14 flex items-center justify-center gap-3 border-2 font-mono text-sm font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-[#CCFF00] border-[#CCFF00] text-black hover:bg-[#d4ff33]";
        this.elements.streamBtn.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>INICIAR STREAM</span>
        `;
      }
    }

    // Flip button
    if (this.elements.flipBtn) {
      this.elements.flipBtn.disabled =
        !this.hasPermission || this.cameras.length < 2;
    }

    // Error
    if (this.elements.errorContainer) {
      this.elements.errorContainer.style.display = this.error ? "flex" : "none";
    }
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = this.error || "";
    }

    this.updateMountedStyles();
  }

  render() {
    const container = document.getElementById("app") || document.body;
    container.innerHTML = `
      <div id="stream-root" class="fixed inset-0 bg-black overflow-hidden select-none">
        <!-- Fullscreen Video Background -->
        <div id="video-container" class="absolute inset-0">
          <!-- Loading State -->
          <div id="loading-state" class="w-full h-full flex items-center justify-center bg-black">
            <div class="flex flex-col items-center gap-4">
              <div class="w-16 h-16 border-4 border-[#CCFF00] border-t-transparent animate-spin"></div>
              <span class="font-mono text-sm text-white/60">CARREGANDO...</span>
            </div>
          </div>

          <!-- Permission State -->
          <div id="permission-state" class="w-full h-full flex items-center justify-center bg-black" style="display: none; opacity: 0; transform: scale(0.9); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);">
            <div class="flex flex-col items-center gap-6 p-8 text-center">
              <div class="w-24 h-24 border-4 border-white/20 flex items-center justify-center">
                <svg class="w-12 h-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="font-mono text-lg text-white mb-2">ACESSO À CÂMERA</p>
                <p class="font-mono text-xs text-white/50 max-w-xs">Permita o acesso à câmera e microfone para continuar</p>
              </div>
              <button id="allow-btn" class="font-mono text-sm bg-[#CCFF00] text-black px-8 py-4 border-4 border-[#CCFF00] hover:bg-transparent hover:text-[#CCFF00] transition-all cursor-pointer">
                PERMITIR
              </button>
            </div>
          </div>

          <!-- Video Preview -->
          <video id="preview-video" autoplay playsinline muted class="w-full h-full object-cover" style="display: none; transform: scaleX(-1);"></video>
        </div>

        <!-- Live Badge -->
        <div id="live-badge" class="absolute top-4 right-4 z-20" style="display: none; opacity: 0; transform: translateY(-20px); transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
          <div class="flex items-center gap-2 bg-red-600 px-4 py-2 border-2 border-red-400">
            <span class="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></span>
            <span class="font-mono text-sm text-white font-bold tracking-wider">AO VIVO</span>
          </div>
        </div>

        <!-- Settings Panel -->
        <div id="settings-panel" class="absolute top-4 left-0 right-0 z-10 mx-3 sm:mx-4" style="display: none; opacity: 0; transform: translateY(-20px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
          <div class="glass-brutal-dark p-4 space-y-4">
            <!-- Camera Select -->
            <div>
              <label class="block font-mono text-[10px] text-white/50 uppercase tracking-wider mb-2">CÂMERA</label>
              <select id="camera-select" class="w-full bg-white/10 border-2 border-white/20 text-white font-mono text-sm p-3 focus:outline-none focus:border-[#CCFF00] cursor-pointer appearance-none select-arrow"></select>
            </div>
            <!-- Microphone Select -->
            <div>
              <label class="block font-mono text-[10px] text-white/50 uppercase tracking-wider mb-2">MICROFONE</label>
              <select id="microphone-select" class="w-full bg-white/10 border-2 border-white/20 text-white font-mono text-sm p-3 focus:outline-none focus:border-[#CCFF00] cursor-pointer appearance-none select-arrow"></select>
            </div>
          </div>
        </div>

        <!-- Bottom Controls -->
        <div id="bottom-controls" class="absolute bottom-0 left-0 right-0 z-20" style="opacity: 0; transform: translateY(100%); transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s;">
          <div class="m-3 sm:m-4">
            <div class="glass-brutal p-4">
              <!-- Error Message -->
              <div id="error-container" class="mb-4 bg-red-500/20 border-2 border-red-500/50 p-3 flex items-center gap-3" style="display: none;">
                <span id="error-message" class="text-red-400 font-mono text-xs"></span>
                <button id="retry-btn" class="font-mono text-[10px] text-white bg-white/20 px-2 py-1 hover:bg-white/30 transition-colors cursor-pointer">RETRY</button>
              </div>

              <!-- Main Controls -->
              <div class="flex items-center justify-between gap-4">
                <!-- Settings Button -->
                <button id="settings-btn" class="w-14 h-14 flex items-center justify-center border-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-black/60 border-white/50 text-white hover:bg-black/80 hover:border-white">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                <!-- Main Stream Button -->
                <button id="stream-btn" class="flex-1 h-14 flex items-center justify-center gap-3 border-2 font-mono text-sm font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-[#CCFF00] border-[#CCFF00] text-black hover:bg-[#d4ff33]">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>INICIAR STREAM</span>
                </button>

                <!-- Camera Flip Button -->
                <button id="flip-btn" class="w-14 h-14 flex items-center justify-center bg-black/60 border-2 border-white/50 text-white hover:bg-black/80 hover:border-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Styles -->
        <style>
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');

          * {
            font-family: 'JetBrains Mono', monospace;
          }

          .glass-brutal {
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 2px solid rgba(255, 255, 255, 0.15);
            box-shadow:
              0 8px 32px rgba(0, 0, 0, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }

          .glass-brutal-dark {
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 2px solid rgba(255, 255, 255, 0.1);
            box-shadow:
              0 8px 32px rgba(0, 0, 0, 0.5),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
          }

          .select-arrow {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            background-size: 16px;
          }

          body {
            overflow: hidden;
          }

          ::selection {
            background: #CCFF00;
            color: #000;
          }

          * {
            -webkit-tap-highlight-color: transparent;
          }

          @supports (padding: max(0px)) {
            .absolute.top-0 > div {
              padding-top: max(0.75rem, env(safe-area-inset-top));
            }
            .absolute.bottom-0 > div {
              padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
            }
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .animate-spin {
            animation: spin 1s linear infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        </style>
      </div>
    `;
  }

  destroy() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
  }
}

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = { StreamPage };
}

// Auto-initialize if DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Get streamId from URL or use default
  const urlParams = new URLSearchParams(window.location.search);
  const streamId = urlParams.get("streamId") || "default";

  window.streamPage = new StreamPage(streamId);
});
