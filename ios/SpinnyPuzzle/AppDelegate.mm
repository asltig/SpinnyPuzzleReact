#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>
#import "Orientation.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];

  self.moduleName = @"SpinnyPuzzle";
  self.initialProps = @{};
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// react-native-orientation-locker: this overrides Info.plist's supported
// orientations at runtime — landscape-locked app-wide by default, with
// SpinnyGamePlayScreen calling Orientation.unlockAllOrientations() while
// focused and Orientation.lockToLandscape() again on blur.
- (UIInterfaceOrientationMask)application:(UIApplication *)application supportedInterfaceOrientationsForWindow:(UIWindow *)window
{
  return [Orientation getOrientation];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
