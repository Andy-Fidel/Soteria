# Diagnostic only. Never use this unconditionally for the portable installer.
include("${CMAKE_CURRENT_LIST_DIR}/windows-cpu.cmake")
set(GGML_AVX ON CACHE BOOL "" FORCE)
set(GGML_AVX2 ON CACHE BOOL "" FORCE)
set(GGML_FMA ON CACHE BOOL "" FORCE)
set(GGML_F16C ON CACHE BOOL "" FORCE)
