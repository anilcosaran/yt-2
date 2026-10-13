import { SparkLab } from '@/components/spark/lab/spark-lab'
import { labViewFromQuery } from '@/components/spark/lab/lab-model'

type SparkLabPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// The Spark workspace without a project: the same screen a project opens in (`/spark/<projectId>`), for review
// links and screenshots. The query is read by `labViewFromQuery`.
export default async function Page({ searchParams }: SparkLabPageProps) {
  return <SparkLab {...labViewFromQuery(await searchParams)} />
}
