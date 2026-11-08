import Image from "next/image"

const images = [
  {
    src: "/release-placeholder.svg",
    width: 1400,
    height: 900,
  },
  {
    src: "/release-placeholder.svg",
    width: 1400,
    height: 900,
  },
  {
    src: "/release-placeholder.svg",
    width: 1400,
    height: 900,
  },
  {
    src: "/release-placeholder.svg",
    width: 1400,
    height: 900,
  },
  {
    src: "/release-placeholder.svg",
    width: 1400,
    height: 900,
  },
  {
    src: "/release-placeholder.svg",
    width: 1400,
    height: 900,
  }
]

export function ImageGrid() {
  return (
    <section className="w-full py-8 md:py-16">
      <div className="container px-4 mx-auto">
        <h2 className="text-3xl sm:text-4xl font-heading font-bold text-center mb-10 tracking-tight">
          Photos to Characters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative aspect-[14/9] rounded-lg overflow-hidden shadow-md"
            >
              <Image 
                src={img.src}
                alt={`Gallery image ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={85}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

