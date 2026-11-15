# LaMa integration notices

FlexCut adapts context crop sizing, symmetric padding, RGB tensor normalization
and masked compositing from D-Ogi/WatermarkRemover-AI at
https://github.com/D-Ogi/WatermarkRemover-AI/tree/127108a5bff1b880ad34ba26ac8b60710b69bb3b/lama_inpaint
(MIT). The processing adapter in that project derives from IOPaint at
https://github.com/Sanster/IOPaint/tree/61a759fb3f332bacdce8b2813f4837495c9b86e0
(Apache-2.0). Both licenses are included here.

FlexCut uses a user-drawn rectangle, pads or resamples its context to a
512-by-512 ONNX input, and composites only the selected region in RGB.
It runs inference locally with ONNX Runtime Web (MIT),
https://github.com/microsoft/onnxruntime/tree/v1.30.0.
The LaMa weights are fetched separately from the quantized ONNX derivative
by othytenk, based on the ONNX export by Carve
(Apache-2.0), https://huggingface.co/Carve/LaMa-ONNX/tree/ea0fcb6813e650b0ad653182f1f6784a3aa812e4.
Quantized model: https://huggingface.co/othytenk/lama-int4-int8/tree/b52ebb642126086fe3da1524a3b1d7629ae4c6a9.
Video decoding and encoding use Mediabunny (MPL-2.0),
https://github.com/Vanilagy/mediabunny/tree/v1.66.0.
