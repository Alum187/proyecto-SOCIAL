import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleDollarSign,
  ExternalLink,
  Landmark,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  BrowserProvider,
  Contract,
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
} from "ethers";
import deployment from "./contracts/deployed.json";

const SEPOLIA_CHAIN_ID = "11155111";
const proposalStates = ["Activa", "Aprobada", "Rechazada", "Ejecutada"];
const blankData = { treasury: "0", tokenBalance: "0", tokenOwner: "", proposals: [] };
const hasDeployment =
  isAddress(deployment.tokenAddress) &&
  isAddress(deployment.daoAddress) &&
  deployment.tokenAbi.length > 0 &&
  deployment.daoAbi.length > 0;

function networkLabel(chainId) {
  if (!chainId) return "Red sin detectar";
  if (chainId === SEPOLIA_CHAIN_ID) return "Sepolia";
  if (chainId === "1") return "Ethereum Mainnet";
  return `Cadena ${chainId}`;
}

function shorten(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEth(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 4 }).format(
    Number(formatEther(BigInt(value))),
  );
}

function formatSdt(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(
    Number(formatUnits(BigInt(value), 18)),
  );
}

function explainError(error) {
  if (error?.code === 4001) return "Rechazaste la solicitud en MetaMask.";
  if (error?.shortMessage) return error.shortMessage;
  if (error?.reason) return error.reason;
  if (error?.info?.error?.message) return error.info.error.message;
  return error?.message || "Ocurrió un error inesperado.";
}

async function readDaoData(provider, account) {
  if (!hasDeployment) return blankData;
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(SEPOLIA_CHAIN_ID)) return blankData;

  const token = new Contract(deployment.tokenAddress, deployment.tokenAbi, provider);
  const dao = new Contract(deployment.daoAddress, deployment.daoAbi, provider);
  const [treasury, tokenOwner, tokenBalance, proposalCount] = await Promise.all([
    provider.getBalance(deployment.daoAddress),
    token.owner(),
    account ? token.balanceOf(account) : 0n,
    dao.proposalCount(),
  ]);

  const proposals = [];
  for (let proposalId = 1n; proposalId <= proposalCount; proposalId += 1n) {
    const [proposal, state, voted] = await Promise.all([
      dao.getProposal(proposalId),
      dao.getProposalState(proposalId),
      account ? dao.hasVoted(proposalId, account) : false,
    ]);
    proposals.push({
      id: proposal.id.toString(),
      title: proposal.title,
      description: proposal.description,
      target: proposal.target,
      amount: proposal.amount.toString(),
      createdAt: proposal.createdAt.toString(),
      deadline: proposal.deadline.toString(),
      votesFor: proposal.votesFor.toString(),
      votesAgainst: proposal.votesAgainst.toString(),
      state: Number(state),
      voted,
    });
  }

  return {
    treasury: treasury.toString(),
    tokenBalance: tokenBalance.toString(),
    tokenOwner,
    proposals: proposals.reverse(),
  };
}

function VoteBar({ proposal }) {
  const votesFor = BigInt(proposal.votesFor);
  const votesAgainst = BigInt(proposal.votesAgainst);
  const total = votesFor + votesAgainst;
  const favorPercent = total === 0n ? 0 : Number((votesFor * 10000n) / total) / 100;

  return (
    <div className="vote-meter" aria-label={`${favorPercent}% de votos a favor`}>
      <div className="vote-meter__favor" style={{ width: `${favorPercent}%` }} />
      <div className="vote-meter__against" style={{ width: `${100 - favorPercent}%` }} />
    </div>
  );
}

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [data, setData] = useState(blankData);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [proposalFormOpen, setProposalFormOpen] = useState(false);
  const [distributionOpen, setDistributionOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    title: "",
    description: "",
    target: "",
    amount: "",
    durationMinutes: "1440",
  });
  const [distributionForm, setDistributionForm] = useState({ address: "", amount: "" });
  const [contributionAmount, setContributionAmount] = useState("");

  const onSepolia = chainId === SEPOLIA_CHAIN_ID;
  const canWrite = Boolean(signer && onSepolia && hasDeployment);
  const isTokenOwner =
    walletAddress && data.tokenOwner && walletAddress.toLowerCase() === data.tokenOwner.toLowerCase();

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const updateWallet = async (account) => {
      if (!active) return;
      if (!account) {
        setWalletAddress("");
        setSigner(null);
        return;
      }

      const nextProvider = new BrowserProvider(ethereum);
      const [network, nextSigner] = await Promise.all([
        nextProvider.getNetwork(),
        nextProvider.getSigner(account),
      ]);
      if (!active) return;
      setProvider(nextProvider);
      setSigner(nextSigner);
      setWalletAddress(account);
      setChainId(network.chainId.toString());
    };

    const handleAccountsChanged = (accounts) => {
      void updateWallet(accounts[0] || "").catch((cause) => setError(explainError(cause)));
    };
    const handleChainChanged = async () => {
      const nextProvider = new BrowserProvider(ethereum);
      const [network, accounts] = await Promise.all([
        nextProvider.getNetwork(),
        ethereum.request({ method: "eth_accounts" }),
      ]);
      if (!active) return;
      setProvider(nextProvider);
      setChainId(network.chainId.toString());
      if (accounts[0]) {
        setWalletAddress(accounts[0]);
        setSigner(await nextProvider.getSigner(accounts[0]));
      }
    };

    const initialProvider = new BrowserProvider(ethereum);
    setProvider(initialProvider);
    void Promise.all([
      initialProvider.getNetwork(),
      ethereum.request({ method: "eth_accounts" }),
    ])
      .then(async ([network, accounts]) => {
        if (!active) return;
        setChainId(network.chainId.toString());
        if (accounts[0]) await updateWallet(accounts[0]);
      })
      .catch((cause) => setError(explainError(cause)))
      .finally(() => {
        if (active) setLoading(false);
      });

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      active = false;
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    if (!provider || !onSepolia || !hasDeployment) {
      setData(blankData);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const refresh = async () => {
      try {
        const nextData = await readDaoData(provider, walletAddress);
        if (active) {
          setData(nextData);
          setError("");
        }
      } catch (cause) {
        if (active) setError(`No se pudieron leer los contratos: ${explainError(cause)}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    setLoading(true);
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [provider, walletAddress, onSepolia, refreshKey]);

  async function connectWallet() {
    setError("");
    if (!window.ethereum) {
      setError("MetaMask no está disponible. Instálalo y vuelve a cargar la página.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const nextProvider = new BrowserProvider(window.ethereum);
      const [network, nextSigner] = await Promise.all([
        nextProvider.getNetwork(),
        nextProvider.getSigner(accounts[0]),
      ]);
      setProvider(nextProvider);
      setSigner(nextSigner);
      setWalletAddress(accounts[0]);
      setChainId(network.chainId.toString());
      setError("");
    } catch (cause) {
      setError(explainError(cause));
    }
  }

  async function sendTransaction(label, send) {
    if (!canWrite) {
      setError("Conecta MetaMask y selecciona Sepolia para firmar transacciones.");
      return false;
    }

    setError("");
    setTransaction({ label, phase: "wallet" });
    try {
      const response = await send();
      setTransaction({ label, phase: "pending", hash: response.hash });
      await response.wait();
      setTransaction({ label, phase: "confirmed", hash: response.hash });
      setRefreshKey((current) => current + 1);
      return true;
    } catch (cause) {
      const message = explainError(cause);
      setTransaction({ label, phase: "error", message });
      setError(message);
      return false;
    }
  }

  async function submitProposal(event) {
    event.preventDefault();
    setError("");
    const durationMinutes = Number(proposalForm.durationMinutes);
    if (!isAddress(proposalForm.target)) {
      setError("Introduce una dirección Ethereum válida para el destino.");
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 43200) {
      setError("La duración debe estar entre 1 minuto y 30 días.");
      return;
    }

    try {
      const dao = new Contract(deployment.daoAddress, deployment.daoAbi, signer);
      const success = await sendTransaction("Crear propuesta", () =>
        dao.createProposal(
          proposalForm.title.trim(),
          proposalForm.description.trim(),
          proposalForm.target,
          parseEther(proposalForm.amount),
          durationMinutes * 60,
        ),
      );
      if (success) {
        setProposalFormOpen(false);
        setProposalForm({ title: "", description: "", target: "", amount: "", durationMinutes: "1440" });
      }
    } catch (cause) {
      setError(explainError(cause));
    }
  }

  async function vote(proposalId, support) {
    const dao = new Contract(deployment.daoAddress, deployment.daoAbi, signer);
    await sendTransaction(support ? "Votar a favor" : "Votar en contra", () =>
      dao.vote(proposalId, support),
    );
  }

  async function executeProposal(proposalId) {
    const dao = new Contract(deployment.daoAddress, deployment.daoAbi, signer);
    await sendTransaction("Ejecutar propuesta", () => dao.executeProposal(proposalId));
  }

  async function distributeTokens(event) {
    event.preventDefault();
    if (!isAddress(distributionForm.address)) {
      setError("Introduce una dirección Ethereum válida para recibir SDT.");
      return;
    }

    try {
      const token = new Contract(deployment.tokenAddress, deployment.tokenAbi, signer);
      const success = await sendTransaction("Distribuir SDT", () =>
        token.distribute(distributionForm.address, parseUnits(distributionForm.amount, 18)),
      );
      if (success) {
        setDistributionForm({ address: "", amount: "" });
        setDistributionOpen(false);
      }
    } catch (cause) {
      setError(explainError(cause));
    }
  }

  async function contribute(event) {
    event.preventDefault();
    try {
      const success = await sendTransaction("Aportar ETH a tesorería", () =>
        signer.sendTransaction({ to: deployment.daoAddress, value: parseEther(contributionAmount) }),
      );
      if (success) {
        setContributionAmount("");
        setContributionOpen(false);
      }
    } catch (cause) {
      setError(explainError(cause));
    }
  }

  const activeProposals = data.proposals.filter((proposal) => proposal.state === 0).length;
  const totalVotingPower = data.proposals.reduce(
    (sum, proposal) => sum + BigInt(proposal.votesFor) + BigInt(proposal.votesAgainst),
    0n,
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Simple DAO, inicio">
          <span className="brand__mark"><Landmark size={18} strokeWidth={2.2} /></span>
          <span>SIMPLE <b>DAO</b></span>
        </a>
        <div className="topbar__actions">
          <div className={`network-pill ${onSepolia ? "network-pill--good" : ""}`}>
            <span className="network-pill__dot" />
            {networkLabel(chainId)}
          </div>
          <button className="button button--dark button--connect" onClick={connectWallet}>
            <Wallet size={16} />
            {walletAddress ? shorten(walletAddress) : "Conectar MetaMask"}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="intro">
          <div className="intro__copy">
            <p className="eyebrow"><span /> GOBERNANZA ABIERTA · ETHEREUM</p>
            <h1>Una comunidad.<br /><em>Una decisión compartida.</em></h1>
            <p className="intro__text">Propuestas transparentes, votos ponderados por SDT y ejecución desde una tesorería común.</p>
          </div>
          <div className="intro__seal" aria-hidden="true">
            <div className="seal-ring"><ShieldCheck size={30} strokeWidth={1.5} /></div>
            <span>ON-CHAIN<br />GOVERNANCE</span>
          </div>
        </section>

        {!window.ethereum && (
          <div className="notice notice--warning">
            <CircleAlert size={18} /> MetaMask no está disponible en este navegador.
          </div>
        )}
        {window.ethereum && chainId && !onSepolia && (
          <div className="notice notice--warning">
            <CircleAlert size={18} /> Estás en {networkLabel(chainId)}. Cambia a Sepolia en MetaMask para leer o enviar transacciones.
          </div>
        )}
        {!hasDeployment && (
          <div className="notice notice--setup">
            <CircleAlert size={18} /> Los contratos aún no están desplegados. La interfaz mostrará datos de Sepolia cuando exista una configuración real.
          </div>
        )}
        {error && (
          <div className="notice notice--error" role="alert">
            <CircleAlert size={18} /> <span>{error}</span>
            <button className="icon-button notice__close" aria-label="Cerrar" onClick={() => setError("")}><X size={16} /></button>
          </div>
        )}

        <section className="metrics" aria-label="Resumen DAO">
          <article className="metric metric--treasury">
            <div className="metric__label"><span>DAO TREASURY BALANCE</span><CircleDollarSign size={18} /></div>
            <strong>{loading ? "···" : onSepolia && hasDeployment ? formatEth(data.treasury) : "—"}<small> ETH</small></strong>
            <div className="metric__footer">
              <span>{onSepolia && hasDeployment ? "Saldo en cadena" : "Disponible en Sepolia"}</span>
              {hasDeployment && <button className="text-button" onClick={() => setContributionOpen((open) => !open)} disabled={!canWrite}>Aportar <ArrowUpRight size={14} /></button>}
            </div>
          </article>
          <article className="metric">
            <div className="metric__label"><span>TU PODER DE VOTO</span><span className="metric__icon"><Wallet size={17} /></span></div>
            <strong>{loading ? "···" : walletAddress && onSepolia && hasDeployment ? formatSdt(data.tokenBalance) : "—"}<small> SDT</small></strong>
            <div className="metric__footer"><span>Balance de la wallet conectada</span></div>
          </article>
          <article className="metric">
            <div className="metric__label"><span>PROPUESTAS ACTIVAS</span><span className="metric__icon"><Check size={17} /></span></div>
            <strong>{loading ? "···" : onSepolia && hasDeployment ? activeProposals : "—"}</strong>
            <div className="metric__footer"><span>{data.proposals.length} en total · {formatSdt(totalVotingPower)} SDT votados</span></div>
          </article>
        </section>

        {(contributionOpen || distributionOpen) && (
          <section className="quick-actions" aria-label="Acciones de tesorería">
            {contributionOpen && (
              <form className="inline-form" onSubmit={contribute}>
                <label htmlFor="contribution">Aportar ETH a la tesorería</label>
                <input id="contribution" type="number" min="0.000001" step="any" required value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} placeholder="0.01" />
                <button className="button button--dark" type="submit" disabled={!canWrite || transaction?.phase === "wallet" || transaction?.phase === "pending"}><ArrowDownToLine size={15} /> Enviar</button>
              </form>
            )}
            {distributionOpen && (
              <form className="inline-form" onSubmit={distributeTokens}>
                <label htmlFor="distribution-address">Distribuir SDT</label>
                <input id="distribution-address" type="text" required value={distributionForm.address} onChange={(event) => setDistributionForm({ ...distributionForm, address: event.target.value })} placeholder="0x dirección destinataria" />
                <input aria-label="Cantidad de SDT" type="number" min="0.000000000000000001" step="any" required value={distributionForm.amount} onChange={(event) => setDistributionForm({ ...distributionForm, amount: event.target.value })} placeholder="Cantidad SDT" />
                <button className="button button--dark" type="submit" disabled={!canWrite || transaction?.phase === "wallet" || transaction?.phase === "pending"}><ArrowDownToLine size={15} /> Distribuir</button>
              </form>
            )}
          </section>
        )}

        {transaction && (
          <section className={`transaction transaction--${transaction.phase}`} aria-live="polite">
            {transaction.phase === "wallet" && <LoaderCircle className="spin" size={18} />}
            {transaction.phase === "pending" && <LoaderCircle className="spin" size={18} />}
            {transaction.phase === "confirmed" && <Check size={18} />}
            {transaction.phase === "error" && <CircleAlert size={18} />}
            <div className="transaction__copy">
              <strong>{transaction.phase === "wallet" ? "Confirma en MetaMask" : transaction.phase === "pending" ? "Esperando confirmación" : transaction.phase === "confirmed" ? "Transacción confirmada" : "Transacción fallida"}</strong>
              <span>{transaction.label}{transaction.message ? ` · ${transaction.message}` : ""}</span>
            </div>
            {transaction.hash && <a href={`https://sepolia.etherscan.io/tx/${transaction.hash}`} target="_blank" rel="noreferrer" className="transaction__link">Ver en Etherscan <ExternalLink size={14} /></a>}
          </section>
        )}

        <section className="proposals-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EL FUTURO DE LA DAO</p>
              <h2>Propuestas <span>{onSepolia && hasDeployment ? data.proposals.length : "—"}</span></h2>
            </div>
            <div className="section-heading__actions">
              {isTokenOwner && <button className="button button--outline" onClick={() => setDistributionOpen((open) => !open)} disabled={!canWrite}><ArrowDownToLine size={16} /> Distribuir SDT</button>}
              <button className="button button--accent" onClick={() => setProposalFormOpen((open) => !open)} disabled={!canWrite}><Plus size={17} /> Crear propuesta</button>
            </div>
          </div>

          {proposalFormOpen && (
            <form className="proposal-form" onSubmit={submitProposal}>
              <div className="proposal-form__top"><div><span className="form-index">NUEVA PROPUESTA</span><h3>Presenta una decisión</h3></div><button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={() => setProposalFormOpen(false)}><X size={18} /></button></div>
              <label>Título<input required maxLength="100" value={proposalForm.title} onChange={(event) => setProposalForm({ ...proposalForm, title: event.target.value })} placeholder="Ej. Comprar un servidor para la DAO" /></label>
              <label>Descripción<textarea required rows="3" value={proposalForm.description} onChange={(event) => setProposalForm({ ...proposalForm, description: event.target.value })} placeholder="Explica el propósito y contexto de la propuesta" /></label>
              <div className="form-grid">
                <label>Dirección destino<input required value={proposalForm.target} onChange={(event) => setProposalForm({ ...proposalForm, target: event.target.value })} placeholder="0x..." /></label>
                <label>Cantidad de ETH<input required type="number" min="0.000000000000000001" step="any" value={proposalForm.amount} onChange={(event) => setProposalForm({ ...proposalForm, amount: event.target.value })} placeholder="0.05" /></label>
                <label>Duración (minutos)<input required type="number" min="1" max="43200" step="1" value={proposalForm.durationMinutes} onChange={(event) => setProposalForm({ ...proposalForm, durationMinutes: event.target.value })} /></label>
              </div>
              <div className="proposal-form__bottom"><span>El contrato admite votaciones de 1 minuto a 30 días.</span><button className="button button--accent" type="submit" disabled={!canWrite || transaction?.phase === "wallet" || transaction?.phase === "pending"}><Plus size={16} /> Crear en Sepolia</button></div>
            </form>
          )}

          {loading && <div className="empty-state"><LoaderCircle className="spin" size={22} /><span>Consultando la blockchain…</span></div>}
          {!loading && hasDeployment && onSepolia && data.proposals.length === 0 && (
            <div className="empty-state"><div className="empty-state__icon"><Landmark size={22} /></div><strong>Aún no hay propuestas</strong><span>La lista aparecerá aquí cuando haya propuestas almacenadas en el contrato.</span></div>
          )}
          {!loading && (!hasDeployment || !onSepolia) && (
            <div className="empty-state"><div className="empty-state__icon"><Landmark size={22} /></div><strong>{!hasDeployment ? "Sin contratos configurados" : "Selecciona Sepolia"}</strong><span>{!hasDeployment ? "No se muestran datos de ejemplo. Despliega los contratos para conectar esta interfaz a la DAO real." : "Conecta una wallet en Sepolia para consultar propuestas y tesorería."}</span></div>
          )}

          {onSepolia && data.proposals.map((proposal) => {
            const stateName = proposalStates[proposal.state] || "Desconocida";
            const canVote = canWrite && proposal.state === 0 && !proposal.voted && BigInt(data.tokenBalance) > 0n;
            const treasuryCanExecute = BigInt(data.treasury) >= BigInt(proposal.amount);
            const deadline = new Date(Number(proposal.deadline) * 1000).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });

            return (
              <article className="proposal" key={proposal.id}>
                <div className="proposal__index">PROPUESTA <b>#{proposal.id.padStart(2, "0")}</b><span className={`status status--${stateName.toLowerCase()}`}>{stateName}</span><span className="proposal__created">Creada {new Date(Number(proposal.createdAt) * 1000).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                <div className="proposal__content">
                  <div className="proposal__main"><h3>{proposal.title}</h3><p>{proposal.description}</p></div>
                  <div className="proposal__request"><span>SOLICITUD</span><strong>{formatEth(proposal.amount)} <small>ETH</small></strong><a href={`https://sepolia.etherscan.io/address/${proposal.target}`} target="_blank" rel="noreferrer">{shorten(proposal.target)} <ExternalLink size={12} /></a></div>
                </div>
                <div className="proposal__votes">
                  <div className="votes-label"><span><i className="vote-dot vote-dot--for" /> A favor <b>{formatSdt(proposal.votesFor)} SDT</b></span><span><i className="vote-dot vote-dot--against" /> En contra <b>{formatSdt(proposal.votesAgainst)} SDT</b></span></div>
                  <VoteBar proposal={proposal} />
                </div>
                <div className="proposal__footer">
                  <span>Finaliza {deadline}{proposal.voted && <b className="voted-label"><Check size={13} /> Ya votaste</b>}</span>
                  <div className="proposal__actions">
                    {proposal.state === 0 && <>
                      <button className="button button--vote-no" onClick={() => vote(proposal.id, false)} disabled={!canVote || transaction?.phase === "wallet" || transaction?.phase === "pending"}><X size={15} /> En contra</button>
                      <button className="button button--vote-yes" onClick={() => vote(proposal.id, true)} disabled={!canVote || transaction?.phase === "wallet" || transaction?.phase === "pending"}><Check size={15} /> A favor</button>
                    </>}
                    {proposal.state === 1 && <button className="button button--accent" onClick={() => executeProposal(proposal.id)} disabled={!canWrite || !treasuryCanExecute || transaction?.phase === "wallet" || transaction?.phase === "pending"}><ArrowUpRight size={16} /> {treasuryCanExecute ? "Ejecutar propuesta" : "Tesorería insuficiente"}</button>}
                    {proposal.state === 2 && <span className="proposal__closed">No alcanzó la mayoría</span>}
                    {proposal.state === 3 && <span className="proposal__closed"><Check size={14} /> Ejecutada en cadena</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {hasDeployment && (
          <footer className="page-footer">
            <span><ShieldCheck size={15} /> Datos leídos directamente de Ethereum Sepolia</span>
            <a href={`https://sepolia.etherscan.io/address/${deployment.daoAddress}`} target="_blank" rel="noreferrer">Contrato DAO <ExternalLink size={13} /></a>
            <span className="footer-note"><CircleDollarSign size={14} /> Cada voto pesa según tu balance SDT al votar.</span>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;