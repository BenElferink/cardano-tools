const getExplorerUrl = (type: 'stakeKey' | 'address' | 'tx' | 'policy' | 'token', value: string) => {
  const baseUrl = 'https://cexplorer.io'

  switch (type) {
    case 'stakeKey':
      return `${baseUrl}/stake/${value}`

    case 'address':
      return `${baseUrl}/address/${value}`

    case 'tx':
      return `${baseUrl}/tx/${value}`

    case 'policy':
      return `${baseUrl}/policy/${value}`

    case 'token':
      return `${baseUrl}/asset/${value}`

    default:
      return `${baseUrl}/`
  }
}

export default getExplorerUrl