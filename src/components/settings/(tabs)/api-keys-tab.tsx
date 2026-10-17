import { DeepgramCredential } from "../(components)/deepgram-credential"
import { AssemblyCredential } from "../(components)/assembly-credential"
import { DeepseekCredential } from "../(components)/deepseek-credential"
import { GeniusCredential } from "../(components)/genius-credential"
import { PexelsCredential } from "../(components)/pexels-credential"
import { UnsplashCredential } from "../(components)/unsplash-credential"
import { BraveCredential } from "../(components)/brave-credential"
export function ApiKeysSection() {
  return (
    <div className="flex flex-col gap-6">
      <DeepgramCredential />
      <AssemblyCredential />
      <DeepseekCredential />
      <GeniusCredential />
      <PexelsCredential />
      <UnsplashCredential />
      <BraveCredential />
    </div>
  )
}
