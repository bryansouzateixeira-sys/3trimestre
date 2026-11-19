document.addEventListener("DOMContentLoaded", () => {
    const jogo = document.getElementById("jogo-frame");
    const botao = document.getElementById("botao-tela-cheia");

    if (!jogo || !botao) {
        console.error("Não foi encontrado o jogo ou o botão de tela cheia.");
        return;
    }

    botao.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await jogo.requestFullscreen();
            }
        } catch (erro) {
            console.error("Erro ao alternar tela cheia:", erro);
            alert("Não foi possível ativar a tela cheia. Tente novamente.");
        }
    });

    document.addEventListener("fullscreenchange", () => {
        botao.textContent = document.fullscreenElement
            ? "Sair da tela cheia (Esc)"
            : "⛶ Tela cheia";
    });
});