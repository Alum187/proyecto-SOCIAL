# Plantilla de Desarrollo Web3 EVM en GitHub Codespaces

Pila completa con Foundry (`forge`, `cast`, `anvil`), Node 20, Vite y Ethers v6, lista para ejecutarse en GitHub Codespaces. Válida para cualquier red compatible con la EVM.

---

## Configuración Inicial

1. **Use this template** → **Create a new repository**.
2. GitHub → **Settings** → **Codespaces** → **New repository secret**, y añade:
   - `RPC_URL`: URL RPC de la red que vayas a utilizar (testnet, L2 o nodo local).
   - `PRIVATE_KEY`: clave privada de una *burner wallet* con prefijo `0x` (**nunca una clave con fondos reales**).
3. **Code** → **Codespaces** → **Create codespace on master**.

---

## Configuración de Redes en Foundry

Define alias de red en `contracts/foundry.toml` para no escribir URLs largas:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

# Alias de redes EVM
[rpc_endpoints]
local = "http://127.0.0.1:8545"
red = "${RPC_URL}"

# Ejemplos:
# sepolia = "https://eth-sepolia.g.alchemy.com/v2/${API_KEY}"
# base = "https://mainnet.base.org"
# arbitrum = "https://arb1.arbitrum.io/rpc"
# polygon = "https://polygon-rpc.com"
```

---

## Uso y Flujo de Trabajo

### Contratos (`contracts/`)

```bash
cd contracts

# Compilar y probar
forge build
forge test

# Desplegar y verificar en Sourcify
forge create src/TuContrato.sol:TuContrato \
  --rpc-url red \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier sourcify

# Desplegar mediante script (contrato Desplegar en script/Desplegar.s.sol)
forge script script/Desplegar.s.sol:Desplegar --rpc-url red --broadcast
```

> **Aviso de seguridad:** con `--private-key $PRIVATE_KEY`, el shell expande la variable y la clave queda visible en los argumentos del proceso (`ps`). Es aceptable solo con una *burner wallet*.

<!--
Versión securizada (keystore cifrado, la clave nunca aparece en argumentos):

  cast wallet import deployer --interactive
  forge create src/TuContrato.sol:TuContrato \
    --rpc-url red \
    --account deployer \
    --broadcast \
    --verify \
    --verifier sourcify
-->

### Frontend (`frontend/`, puerto 5173)

```bash
cd frontend
npm run dev -- --host
```

> **Otro framework:** para Svelte, React o Vue en lugar de JavaScript puro, edita `.devcontainer/post-create.sh`:
> ```bash
> [ -d frontend ] || npm create -y vite@latest frontend -- --template svelte --no-interactive
> ```

---

## Estructura del Repositorio

```text
.devcontainer/       Contenedor y configuración de Codespaces
contracts/           Proyecto Foundry
  ├── src/           Solidity (.sol)
  ├── test/          Tests (.t.sol)
  ├── script/        Scripts de despliegue (.s.sol)
  └── foundry.toml   Compilador, redes y verificadores
frontend/            Vite + Vanilla JS + Ethers v6
.env.example         Variables requeridas (configúralas como secrets en GitHub)
README.md            Documentación
```

---

## Solución de Problemas

* **Ayuda:** pregunta a Copilot en Codespaces.
* **Error al crear el contenedor:** paleta de comandos (`F1`, `Ctrl+Shift+P` o `Cmd+Shift+P`) → `Codespaces: View Creation Log`.
* **Fondos de prueba (gas):** usa el faucet de la testnet elegida hacia la dirección de tu `PRIVATE_KEY`.
* **Consultar saldo antes de desplegar:**

```bash
cast balance <TU_DIRECCION_PUBLICA> --rpc-url red
```
