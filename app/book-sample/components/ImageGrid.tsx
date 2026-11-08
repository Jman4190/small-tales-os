import Image from "next/image"

const images = [
  {
    src: "/release-placeholder.svg",
    width: 1200,
    height: 600,
  },
  {
    src: "/release-placeholder.svg",
    width: 1200,
    height: 600,
  },
  {
    src: "/release-placeholder.svg",
    width: 1200,
    height: 600,
  },
  {
    src: "/release-placeholder.svg",
    width: 1200,
    height: 600,
  },
  {
    src: "/release-placeholder.svg",
    width: 1200,
    height: 600,
  },
  {
    src: "/release-placeholder.svg",
    width: 1200,
    height: 600,
  }
]

export function ImageGrid() {
  return (
    <section className="w-full pt-4">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col gap-8 max-w-4xl mx-auto">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative aspect-[2/1] rounded-lg overflow-hidden"
            >
              <Image 
                src={img.src}
                alt={`Book page ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 896px) 100vw, 896px"
                quality={85}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 