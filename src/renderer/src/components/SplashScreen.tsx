import { FabricatorMark } from './FabricatorMark'

/** A calm VESPERTTINE mark anchors workspace startup. */
function BuildingLogo(): JSX.Element {
  return <FabricatorMark className="splash-logo" />
}

export default function SplashScreen(): JSX.Element {
  return (
    <div className="splash">
      <div className="splash-hero">
        <div className="splash-stage">
          <BuildingLogo />
        </div>
        <div className="splash-wordmark">
          <span className="splash-word">VESPERTTINE RAYFIN EDITOR</span>
          <span className="splash-sub">Setting up your workspace…</span>
        </div>
      </div>
      <div className="splash-progress" aria-hidden="true">
        <span />
      </div>
    </div>
  )
}
