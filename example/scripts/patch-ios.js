const fs = require('fs');
const path = require('path');

const podfilePath = path.join(__dirname, '../ios/Podfile');

if (fs.existsSync(podfilePath)) {
  let content = fs.readFileSync(podfilePath, 'utf8');

  // 1. Add FMT_USE_CONSTEVAL=0 flag to all targets
  const fmtFlagCode = `
    # Disable FMT_USE_CONSTEVAL for Clang 15+ compilation compatibility
    # and link ReplayKit framework for react-native-record-screen
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] ||= ['$(inherited)']
        if config.build_settings['OTHER_CPLUSPLUSFLAGS'].is_a?(Array)
          config.build_settings['OTHER_CPLUSPLUSFLAGS'] << '-DFMT_USE_CONSTEVAL=0'
        else
          config.build_settings['OTHER_CPLUSPLUSFLAGS'] += ' -DFMT_USE_CONSTEVAL=0'
        end
      end

      # Link ReplayKit framework for react-native-record-screen
      if target.name == 'react-native-record-screen'
        target.build_configurations.each do |config|
          ldflags = config.build_settings['OTHER_LDFLAGS'] || '$(inherited)'
          if ldflags.is_a?(Array)
            ldflags << '-framework' << 'ReplayKit' unless ldflags.include?('ReplayKit')
          else
            ldflags += ' -framework ReplayKit' unless ldflags.include?('ReplayKit')
          end
          config.build_settings['OTHER_LDFLAGS'] = ldflags
        end
      end
    end
  `;

  // 2. Add header patching logic for fmt
  const fmtHeaderPatchCode = `
    # Direct patch of fmt headers to force FMT_USE_CONSTEVAL to 0
    ['fmt/include/fmt/base.h', 'fmt/include/fmt/format-inl.h'].each do |rel_path|
      file_path = File.join(installer.sandbox.root, rel_path)
      if File.exist?(file_path)
        content = File.read(file_path)
        modified = false
        if !content.include?('#define FMT_USE_CONSTEVAL 0')
          content = "#define FMT_USE_CONSTEVAL 0\\n" + content
          modified = true
        end
        # Ensure no nested block overrides FMT_USE_CONSTEVAL to 1
        if content.include?('#  define FMT_USE_CONSTEVAL 1')
          content = content.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0')
          modified = true
        end
        if modified
          File.chmod(0644, file_path) rescue nil
          File.write(file_path, content)
        end
      end
    end
  `;

  // Inject our code right after "react_native_post_install(installer, ...)"
  const targetLine = /react_native_post_install\([\s\S]*?ccache_enabled\?[\s\S]*?\n\s*\)/;
  const match = content.match(targetLine);
  if (match) {
    const postInstallBlock = match[0] + fmtFlagCode + fmtHeaderPatchCode;
    // Prevent double injection
    if (!content.includes('FMT_USE_CONSTEVAL')) {
      content = content.replace(targetLine, postInstallBlock);
      fs.writeFileSync(podfilePath, content, 'utf8');
      console.log('✅ Patched ios/Podfile successfully.');
    } else {
      console.log('ℹ️ ios/Podfile already patched.');
    }
  } else {
    console.error('❌ Could not find post_install section in Podfile to patch.');
  }
} else {
  console.log('⚠️ ios/Podfile does not exist yet.');
}
