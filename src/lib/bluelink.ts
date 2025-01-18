
import { ioniq5 } from "resources/images"


export interface BluelinkProps {
  username: string
  password: string
  region: string
}

export class Bluelink {
  private props: BluelinkProps

  public constructor(props: BluelinkProps) {
    this.props = props
    this.doLogin()

  }

  private doLogin() {
    log(this.props.username)
    // actually do login here
  }

  public getCarImage() : string {
    return ioniq5
  }

  public getCarName(): string {
    return "Ioniq 5"
  }
}