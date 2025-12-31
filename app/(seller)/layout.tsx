import SellerLayout from '@/components/seller-layout'

export default function SellerRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SellerLayout>{children}</SellerLayout>
}

