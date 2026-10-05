# Simple DAO

DAO educativa en Ethereum Sepolia con Solidity, Hardhat, OpenZeppelin, ERC20Votes, React, Vite y ethers v6. Incluye token SDT, propuestas ponderadas, tesorería ETH y ejecución on-chain. `contracts/` conserva el scaffold Foundry; Hardhat usa `contracts/src/` y mantiene tests y scripts separados.

## 1. Requisitos

- Node.js 20+, npm y Foundry (`forge`).
- MetaMask y una wallet de prueba configurada para Sepolia.
- Sepolia ETH para gas y un endpoint RPC de Sepolia.

## 2. Instalación

Desde la raíz:

```bash
npm install
npm install --prefix frontend
```

## 3. Configurar `.env`

```bash
cp .env.example .env
```

Completa una variable RPC y una clave de una wallet desechable:

```dotenv
ALCHEMY_RPC_URL=
# Alternativa: SEPOLIA_RPC_URL=
PRIVATE_KEY=0x...
```

`.env` está ignorado por Git. No uses una wallet con fondos reales, no compartas la clave y no la incluyas en el frontend.

## 4. Crear wallet de prueba

Crea una cuenta nueva en MetaMask o una wallet independiente de desarrollo. Exporta su clave solo al `.env` local. La cuenta que despliega será dueña del token y podrá distribuir SDT.

## 5. Obtener Sepolia ETH

Copia la dirección pública de esa cuenta y solicita Sepolia ETH en un faucet de Ethereum Sepolia. Reserva fondos para el deploy y el gas de las transacciones.

## 6. Configurar Alchemy

Crea una app de Ethereum Sepolia en Alchemy y copia su HTTPS RPC endpoint a `ALCHEMY_RPC_URL`. Para otro proveedor usa `SEPOLIA_RPC_URL`. No guardes el endpoint en el código.

## 7. Compilar

```bash
npm run compile
cd contracts && forge build
```

Hardhat compila para Cancun, compatible con OpenZeppelin actual y Sepolia.

## 8. Tests

```bash
npm test
cd contracts && forge test
```

Hardhat usa una blockchain local efímera; no envía transacciones a Sepolia ni necesita secretos.

## 9. Deploy Sepolia

Verifica que `.env` tenga RPC y `PRIVATE_KEY`, y que la cuenta tenga ETH de prueba. Ejecuta desde la raíz:

```bash
npm run deploy:sepolia
```

El script exige chain ID `11155111`, despliega `GovernanceToken` y `SimpleDAO`, imprime sus direcciones y guarda las direcciones, red y ABI reales en `frontend/src/contracts/deployed.json`. El archivo empieza vacío hasta un deploy real; no pongas valores inventados.

## 10. Configurar frontend

El deploy genera la configuración pública que importa Vite. No copies `PRIVATE_KEY` a `frontend/` ni a variables `VITE_*`. Para otro despliegue, ejecuta de nuevo el script con las credenciales adecuadas.

## 11. Ejecutar frontend

```bash
cd frontend
npm run dev -- --host
```

Vite mostrará la URL local o de Codespaces.

## 12. Conectar MetaMask

Abre la URL, pulsa **Conectar MetaMask** y aprueba la conexión. Selecciona Sepolia. La interfaz detecta wallet/red y deshabilita escrituras cuando la red no es Sepolia.

## 13. Crear propuesta

Pulsa **Crear propuesta** y completa título, descripción, destino, cantidad ETH y duración. El contrato acepta duraciones de 1 minuto a 30 días. MetaMask pide la firma y la interfaz muestra espera, confirmación, hash y enlace a Sepolia Etherscan.

## 14. Votar

El peso se fija en el snapshot del bloque anterior a crear la propuesta. Cada dirección puede votar una vez y transferir SDT después no vuelve a contar esos votos. El deployer puede entregar tokens desde **Distribuir SDT**; el token auto-delega para que el titular pueda votar.

## 15. Ejecutar propuesta

Al terminar la votación, cualquiera puede ejecutar si `votesFor > votesAgainst` y la tesorería tiene fondos suficientes. El contrato marca la propuesta antes de enviar ETH y usa `ReentrancyGuard`. Usa **Aportar** para fondear la tesorería.

## 16. Verificar en Sepolia Etherscan

Abre **Ver en Etherscan** tras cada transacción. También puedes buscar la dirección DAO impresa al desplegar para consultar saldo, transacciones y eventos. Direcciones y hashes aparecen solo después de un deploy o transacción real.

## Modelo educativo y límites

- No existe quorum: se aprueba por mayoría estricta al vencer el plazo.
- El dueño puede acuñar SDT adicional al distribuirlo; confía solo en el deployer de pruebas.
- Cualquiera puede crear propuestas. La DAO envía ETH al destino aprobado, sin ejecutar calldata arbitraria.
- Los tests no sustituyen una auditoría. Utiliza Sepolia y wallets de prueba.
