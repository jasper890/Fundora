package expo.modules.fundorasigner

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JNI bindings to the Rust signer in ../../rust (libfundora_signer.so). */
object RustSigner {
  init {
    System.loadLibrary("fundora_signer")
  }

  external fun generate(): String
  external fun publicKey(secret: String): String
  external fun signAwardCall(
    envelope: String,
    passphrase: String,
    signer: String,
    action: String,
    maxFee: String,
    nowSeconds: Double,
    secret: String,
  ): String
}

class FundoraSignerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FundoraSigner")

    Function("generate") { RustSigner.generate() }

    Function("publicKey") { secret: String -> RustSigner.publicKey(secret) }

    Function("signAwardCall") {
        envelope: String, passphrase: String, signer: String, action: String, maxFee: String, nowSeconds: Double, secret: String ->
      RustSigner.signAwardCall(envelope, passphrase, signer, action, maxFee, nowSeconds, secret)
    }
  }
}
