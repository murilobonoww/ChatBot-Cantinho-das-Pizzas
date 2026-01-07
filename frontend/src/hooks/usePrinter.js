function print() {
    if (!window.api) {
        alert('Impressão só disponível na versão desktop.')
        return
    }

    window.api.print()

    return {
        print
    }
}