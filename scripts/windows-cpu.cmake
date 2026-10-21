# Windows portable CPU build: no GPU driver or AVX requirement.
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_AVX OFF CACHE BOOL "" FORCE)
set(GGML_AVX2 OFF CACHE BOOL "" FORCE)
set(GGML_AVX512 OFF CACHE BOOL "" FORCE)
set(GGML_FMA OFF CACHE BOOL "" FORCE)
set(GGML_F16C OFF CACHE BOOL "" FORCE)
# Match Rust/cc dependencies to the DLL Microsoft runtime.
set(CMAKE_POLICY_DEFAULT_CMP0091 NEW CACHE STRING "" FORCE)
set(CMAKE_MSVC_RUNTIME_LIBRARY MultiThreadedDLL CACHE STRING "" FORCE)
# cmake-rs replaces MSVC Release flags to select the runtime, dropping /O2.
# Restore native optimization explicitly; Rust's release profile is separate.
set(CMAKE_C_FLAGS_RELEASE "/O2 /Ob2 /DNDEBUG" CACHE STRING "" FORCE)
set(CMAKE_CXX_FLAGS_RELEASE "/O2 /Ob2 /DNDEBUG" CACHE STRING "" FORCE)
