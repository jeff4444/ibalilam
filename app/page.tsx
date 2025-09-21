import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  Cpu,
  Wrench,
  ShoppingCart,
  Users,
  Shield,
  Zap,
  CircuitBoard,
  Search,
  PenToolIcon as Tool,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center border-b sticky top-0 z-30 bg-white">
        <Link className="flex items-center justify-center" href="/">
          <Cpu className="h-6 w-6 mr-2 text-blue-600" />
          <span className="font-bold text-xl">Techafon</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/parts">
            Browse Parts
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/favorites">
            Favorites
          </Link>
          {/* Show Dashboard and Profile when logged in */}
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/profile">
            Profile
          </Link>
          {/* Show Login/Sign Up when not logged in */}
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/login">
            Login
          </Link>
          <Link className="text-sm font-medium hover:text-blue-600 transition-colors" href="/signup">
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="flex flex-row w-full py-12 md:py-24 lg:py-32 bg-gradient-to-r from-blue-50 to-blue-100 items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">
                    Electronics Marketplace
                  </Badge>
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Buy, Sell & Repair Electronic Parts
                  </h1>
                  <p className="max-w-[600px] text-gray-600 md:text-xl">
                    The marketplace built for technicians. Find the parts you need, sell your extras, and give old
                    electronics new life through repair and refurbishment.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                    <Link href="/signup">
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link href="/parts">Browse Parts</Link>
                  </Button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">10,000+</div>
                    <div className="text-sm text-gray-500">Parts Available</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">500+</div>
                    <div className="text-sm text-gray-500">Active Technicians</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">24/7</div>
                    <div className="text-sm text-gray-500">Support</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-xl">
                  <Image
                    src="/placeholder.svg?height=400&width=600"
                    alt="Electronic components and circuit boards"
                    fill
                    className="object-cover"
                  />

                  {/* Overlay with tech elements */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent">
                    <div className="absolute top-4 left-4 bg-white/90 p-2 rounded-lg shadow-lg">
                      <CircuitBoard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="absolute top-4 right-4 bg-white/90 p-2 rounded-lg shadow-lg">
                      <Cpu className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-lg shadow-lg">
                      <Wrench className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="absolute bottom-4 right-4 bg-white/90 p-2 rounded-lg shadow-lg">
                      <Tool className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="flex flex-row w-full py-12 md:py-24 lg:py-32 items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">How It Works</h2>
                <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Our simple three-step process connects technicians and electronic parts
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              <Card className="border-2 border-blue-100 hover:border-blue-200 transition-all duration-300 shadow-sm">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center">
                    <ShoppingCart className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle>Buy Parts</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Find the electronic components you need from our marketplace. From vintage chips to modern sensors,
                    we have it all.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-100 hover:border-blue-200 transition-all duration-300 shadow-sm">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center">
                    <Wrench className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle>Repair & Refurbish</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Give old electronics new life. Clean, repair, and upgrade components to create valuable refurbished
                    parts.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-100 hover:border-blue-200 transition-all duration-300 shadow-sm">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-blue-50 rounded-full w-16 h-16 flex items-center justify-center">
                    <Cpu className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle>Sell</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    List your original or refurbished parts on our marketplace. Reach thousands of technicians and
                    electronics enthusiasts.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Popular Categories */}
        <section className="flex flex-row w-full py-12 md:py-24 lg:py-32 bg-gray-50 items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Popular Categories</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Browse our most popular electronic component categories
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/parts?category=microcontrollers" className="group">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                  <div className="p-3 bg-blue-50 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
                    <Cpu className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium">Microcontrollers</h3>
                  <p className="text-sm text-gray-500 mt-1">Arduino, ESP32, Raspberry Pi</p>
                </div>
              </Link>

              <Link href="/parts?category=sensors" className="group">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                  <div className="p-3 bg-blue-50 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
                    <Search className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium">Sensors</h3>
                  <p className="text-sm text-gray-500 mt-1">Temperature, Pressure, Motion</p>
                </div>
              </Link>

              <Link href="/parts?category=displays" className="group">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                  <div className="p-3 bg-blue-50 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
                    <CircuitBoard className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium">Displays</h3>
                  <p className="text-sm text-gray-500 mt-1">LCD, OLED, LED Matrices</p>
                </div>
              </Link>

              <Link href="/parts?category=tools" className="group">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                  <div className="p-3 bg-blue-50 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
                    <Tool className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium">Tools</h3>
                  <p className="text-sm text-gray-500 mt-1">Soldering, Testing, Measurement</p>
                </div>
              </Link>
            </div>

            <div className="flex justify-center mt-8">
              <Button variant="outline" asChild>
                <Link href="/parts">View All Categories</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="flex flex-row w-full py-12 md:py-24 lg:py-32 items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_500px] lg:gap-12 xl:grid-cols-[1fr_550px]">
              <div className="flex flex-col justify-center space-y-4">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Why Choose Techafon?</h2>
                <p className="text-gray-500 md:text-xl">
                  Join the community of technicians and electronics enthusiasts with our trusted marketplace platform.
                </p>
                <ul className="grid gap-4 py-4">
                  <li className="flex items-center gap-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                    <div className="bg-blue-50 p-2 rounded-full">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Verified Sellers</h3>
                      <p className="text-sm text-gray-500">
                        All sellers are verified technicians with proven expertise
                      </p>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                    <div className="bg-blue-50 p-2 rounded-full">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Active Community</h3>
                      <p className="text-sm text-gray-500">Connect with other technicians for advice and support</p>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                    <div className="bg-blue-50 p-2 rounded-full">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Buyer Protection</h3>
                      <p className="text-sm text-gray-500">
                        Secure payments and satisfaction guarantee on all purchases
                      </p>
                    </div>
                  </li>
                  <li className="flex items-center gap-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                    <div className="bg-blue-50 p-2 rounded-full">
                      <Zap className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Fast Shipping</h3>
                      <p className="text-sm text-gray-500">Quick delivery options to get parts when you need them</p>
                    </div>
                  </li>
                </ul>
              </div>
              <Image
                src="/placeholder.svg?height=400&width=550"
                alt="Electronics workshop with various components"
                width={550}
                height={400}
                className="mx-auto aspect-video overflow-hidden rounded-xl object-cover shadow-xl"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="flex flex-row w-full py-12 md:py-24 lg:py-32 bg-blue-600 text-white items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Ready to Start Trading?</h2>
                <p className="max-w-[600px] text-blue-100 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Join thousands of electronics technicians already using Techafon.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50" asChild>
                  <Link href="/signup">Create Account</Link>
                </Button>
                <Button variant="outline" size="lg" className="border-white text-white hover:bg-blue-700" asChild>
                  <Link href="/parts">Explore Marketplace</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="container px-4 md:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-medium mb-4">Products</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Electronic Components
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Microcontrollers
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Sensors & Modules
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Tools & Equipment
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Repair Guides
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Component Database
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Tutorials
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Community Forum
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Shipping Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-gray-600 hover:text-blue-600">
                    Return Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center border-t border-gray-200 mt-8 pt-8">
            <div className="flex items-center mb-4 md:mb-0">
              <Cpu className="h-6 w-6 mr-2 text-blue-600" />
              <span className="font-bold">Techafon</span>
            </div>
            <p className="text-sm text-gray-500">© 2024 Techafon. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
