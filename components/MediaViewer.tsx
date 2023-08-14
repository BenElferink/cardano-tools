import Image from 'next/image'
import { useMemo } from 'react'
import { MEDIA_TYPES } from '@/constants'
import type { MediaType } from '@/@types'

const MediaViewer = (props: { mediaType: MediaType; src: string; size?: string; withBorder?: boolean }) => {
  const { mediaType, src, size, withBorder } = props

  const className = useMemo(
    () => (size ? size : 'w-[100px] h-[100px]') + ' object-contain rounded-lg ' + (withBorder ? 'm-1 border border-zinc-600' : ''),
    [size, withBorder]
  )

  const w = Number(className.split(' ')[0]?.replace('w-[', '')?.replace('px]', ''))
  const h = Number(className.split(' ')[1]?.replace('h-[', '')?.replace('px]', ''))

  return mediaType === MEDIA_TYPES['IMAGE'] ? (
    <Image src={src} alt='' className={className} width={Number.isNaN(w) ? 1000 : w} height={Number.isNaN(h) ? 1000 : h} priority unoptimized />
  ) : mediaType === MEDIA_TYPES['VIDEO'] ? (
    <video src={src} controls className={className} />
  ) : mediaType === MEDIA_TYPES['AUDIO'] ? (
    <audio src={src} controls />
  ) : null
}

export default MediaViewer
