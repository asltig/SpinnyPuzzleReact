//
//  UIView+ShadowsIO.h
//  CirclePuzzle
//
//  Created by Gevorg Nanyan on 2/28/18.
//  Copyright © 2018 MagicDevs. All rights reserved.
//

#import <UIKit/UIKit.h>
#import "CircleView.h"

@interface UIView (ShadowsIO)

-(void)md_outterShadow:(CircleView *)circle withShadowOpacity:(NSInteger)opacity in:(BOOL)isIn;
-(void)md_innerShadow:(CircleView *)circle;

@end
