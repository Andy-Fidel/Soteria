include("${CMAKE_CURRENT_LIST_DIR}/windows-cpu.cmake")
# MSVC does not define GCC-style SSE macros when /arch:AVX is off.
# Select ggml's SSE3 vector kernels without requiring AVX or AVX2.
add_compile_definitions(__SSE2__ __SSE3__)
