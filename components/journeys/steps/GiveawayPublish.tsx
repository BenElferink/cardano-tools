import { useCallback, useState } from 'react'
import { Transaction } from '@meshsdk/core'
import { useWallet } from '@meshsdk/react'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import { useAuth } from '@/contexts/AuthContext'
import { badApi } from '@/utils/badApi'
import { firestore } from '@/utils/firebase'
import formatTokenAmount from '@/functions/formatters/formatTokenAmount'
import JourneyStepWrapper from './JourneyStepWrapper'
import ProgressBar from '@/components/ProgressBar'
import Loader from '@/components/Loader'
import type {
  BadApiBaseToken,
  BadApiTokenOwners,
  FungibleTokenHolderWithPoints,
  Giveaway,
  GiveawaySettings,
} from '@/@types'
import { DECIMALS, WALLET_ADDRESSES } from '@/constants'
import { toast } from 'react-hot-toast'

const GiveawayPublish = (props: { settings: GiveawaySettings; next?: () => void; back?: () => void }) => {
  const { settings, next, back } = props
  const { user } = useAuth()
  const { wallet } = useWallet()

  const [publishedUrl, setPublishedUrl] = useState('')
  const [published, setPublished] = useState(false)
  const [progress, setProgress] = useState({
    msg: '',
    loading: false,
    policy: {
      current: 0,
      max: settings.holderPolicies.length || 0,
    },
    token: {
      current: 0,
      max: 0,
    },
  })

  const clickPublish = useCallback(async () => {
    if (!settings) return
    setProgress((prev) => ({ ...prev, loading: true, msg: 'Processing Policy IDs...' }))

    try {
      const { isToken, tokenId, tokenAmount, numOfWinners, holderPolicies } = settings

      const updatedHolderPolicies = [...holderPolicies]
      const fungibleTokens: (BadApiBaseToken & { policyId: string })[] = []

      setProgress((prev) => ({
        ...prev,
        policy: { ...prev.policy, current: 0, max: updatedHolderPolicies.length },
      }))

      for (let pIdx = 0; pIdx < updatedHolderPolicies.length; pIdx++) {
        const { policyId } = updatedHolderPolicies[pIdx]
        const { tokens: policyTokens } = await badApi.policy.getData(policyId, { allTokens: true })

        for (const token of policyTokens) {
          if (token.isFungible) {
            updatedHolderPolicies[pIdx].hasFungibleTokens = true
            fungibleTokens.push({ ...token, policyId })
          }
        }

        setProgress((prev) => ({
          ...prev,
          policy: { ...prev.policy, current: prev.policy.current + 1, max: updatedHolderPolicies.length },
        }))
      }

      const fungibleHolders: FungibleTokenHolderWithPoints[] = []

      if (fungibleTokens.length) {
        setProgress((prev) => ({
          ...prev,
          token: { ...prev.token, current: 0, max: fungibleTokens.length },
          msg: '',
        }))

        const shouldRunSnapshot = window.confirm(
          'Detected Policy ID(s) with Fungible Token(s).\n\nFungible Tokens cannot be "scanned" when the holder connects, because they are not "unique" assets.\n\nThe solution would be running a snapshot. Do you want to run a snapshot now?\n\nBy clicking "cancel", the giveaway will not be published, allowing you to make changes.'
        )

        if (!shouldRunSnapshot) {
          setProgress((prev) => ({ ...prev, loading: false, msg: '' }))
          return
        } else {
          const tempHolders: {
            stakeKey: string
            assets: {
              [policyId: string]: {
                assetId: string
                amount: number
              }[]
            }
          }[] = []

          for (let tIdx = 0; tIdx < fungibleTokens.length; tIdx++) {
            const { policyId, tokenId, tokenAmount } = fungibleTokens[tIdx]
            const tokenOwners: BadApiTokenOwners['owners'] = []

            for (let page = 1; true; page++) {
              setProgress((prev) => ({ ...prev, msg: `Processing Holders (${tokenOwners.length})` }))

              const fetched = await badApi.token.getOwners(tokenId, { page })

              if (!fetched.owners.length) break
              tokenOwners.push(...fetched.owners)

              if (fetched.owners.length < 100) break
            }

            setProgress((prev) => ({ ...prev, msg: `Processing Holders (${tokenOwners.length})` }))

            for (const owner of tokenOwners) {
              const { quantity, stakeKey, addresses } = owner
              const { address, isScript } = addresses[0]

              const isOnCardano = address.indexOf('addr1') === 0
              // const isBlacklisted = withBlacklist && !!blacklistWallets.find((str) => str === stakeKey)
              // const isDelegator = !withDelegators || (withDelegators && delegators.includes(stakeKey))

              if (
                isOnCardano &&
                !!stakeKey &&
                !isScript
                // && !isBlacklisted
                // && isDelegator
              ) {
                const foundIndex = tempHolders.findIndex((item) => item.stakeKey === stakeKey)

                const holderAsset = {
                  assetId: tokenId,
                  amount: formatTokenAmount.fromChain(quantity, tokenAmount.decimals),
                }

                if (foundIndex === -1) {
                  tempHolders.push({
                    stakeKey,
                    assets: {
                      [policyId]: [holderAsset],
                    },
                  })
                } else if (Array.isArray(tempHolders[foundIndex].assets[policyId])) {
                  tempHolders[foundIndex].assets[policyId].push(holderAsset)
                } else {
                  tempHolders[foundIndex].assets[policyId] = [holderAsset]
                }
              }
            }

            setProgress((prev) => ({
              ...prev,
              token: { ...prev.token, current: prev.token.current + 1, max: fungibleTokens.length },
            }))
          }

          fungibleHolders.push(
            ...tempHolders
              .map(({ stakeKey, assets }) => {
                let points = 0

                Object.entries(assets).forEach(([heldPolicyId, heldPolicyAssets]) => {
                  const policySetting = updatedHolderPolicies.find((item) => item.policyId === heldPolicyId)
                  const policyWeight = policySetting?.weight || 0

                  for (const { amount } of heldPolicyAssets) {
                    points += amount * policyWeight
                  }
                })

                points = Math.floor(points)

                return {
                  stakeKey,
                  points,
                  hasEntered: false,
                }
              })
              .sort((a, b) => b.points - a.points)
          )
        }
      }

      setProgress((prev) => ({
        ...prev,
        msg: 'Publishing...',
      }))

      const collection = firestore.collection('giveaways')

      let docId = ''
      const payload: Giveaway = {
        ...settings,
        stakeKey: user?.stakeKey as string,
        active: true,
        fungibleHolders,
        nonFungibleUsedUnits: [],
        entries: [],
        winners: [],
      }

      if (isToken) {
        const lovelaces = formatTokenAmount.toChain(numOfWinners * 1.5, DECIMALS['ADA'])

        const tx = new Transaction({ initiator: wallet })
          .sendLovelace({ address: WALLET_ADDRESSES['GIVEAWAYS'] }, lovelaces.toString())
          .sendAssets({ address: WALLET_ADDRESSES['GIVEAWAYS'] }, [
            {
              unit: tokenId,
              quantity: tokenAmount.onChain.toString(),
            },
          ])

        console.log('Building TX...')
        const unsigned = await tx.build()
        console.log('Awaiting signature...', unsigned)
        const signed = await wallet.signTx(unsigned)
        console.log('Submitting TX...', signed)
        const txHash = await wallet.submitTx(signed)
        console.log('TX submitted!', txHash)

        const { id } = await collection.add({
          ...payload,
          txDeposit: txHash,
          txsWithdrawn: [],
        })

        docId = id
      } else {
        const { id } = await collection.add(payload)

        docId = id
      }

      setProgress((prev) => ({ ...prev, loading: false, msg: 'Giveaway Published!' }))
      setPublished(true)

      const url = `${window.location.origin}/giveaways?id=${docId}`
      setPublishedUrl(url)
    } catch (error: any) {
      console.error(error)
      const errMsg = error?.response?.data || error?.message || error?.toString() || 'UNKNOWN ERROR'

      if (errMsg.indexOf('Not enough ADA leftover to include non-ADA assets in a change address') !== -1) {
        setProgress((prev) => ({
          ...prev,
          loading: false,
          msg: 'TX build failed: your UTXOs are clogged, please send all your ADA to yourself, together with the selected tokens.',
        }))
      } else if (error?.message?.indexOf('UTxO Balance Insufficient') !== -1) {
        setProgress((prev) => ({
          ...prev,
          loading: false,
          msg: 'TX build failed: not enough ADA to process TX, please add ADA to your wallet, then try again.',
        }))
      } else {
        setProgress((prev) => ({ ...prev, loading: false, msg: errMsg }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, user, wallet])

  return (
    <JourneyStepWrapper
      disableNext={progress.loading || !published}
      disableBack={progress.loading || published}
      next={next}
      back={back}
      buttons={[
        {
          label: 'Publish',
          disabled: progress.loading || published,
          onClick: () => clickPublish(),
        },
        {
          label: 'Copy URL',
          disabled: progress.loading || !published || !publishedUrl,
          onClick: () => {
            navigator.clipboard.writeText(publishedUrl)
            toast.success('Copied')
          },
        },
      ]}
    >
      <h6 className='mb-6 text-xl text-center'>Publish Giveaway</h6>

      {!published && progress.policy.max ? (
        <ProgressBar label='Policy IDs' max={progress.policy.max} current={progress.policy.current} />
      ) : null}

      {!published && progress.token.max ? (
        <ProgressBar label='Fungible Tokens' max={progress.token.max} current={progress.token.current} />
      ) : null}

      {progress.loading ? (
        <Loader withLabel label={progress.msg} />
      ) : (
        <div className='flex flex-col items-center justify-center'>
          {published ? <CheckBadgeIcon className='w-24 h-24 text-green-400' /> : null}
          <span>{progress.msg}</span>
        </div>
      )}
    </JourneyStepWrapper>
  )
}

export default GiveawayPublish